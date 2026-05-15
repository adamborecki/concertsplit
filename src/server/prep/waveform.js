import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnFfmpeg } from '../ffmpeg.js';

const SAMPLE_RATE = 22050;
const SAMPLES_PER_PIXEL = 256;
const NUM_CHUNKS = 8;

export async function generateWaveform({ masterPath, outPath, duration, onProgress }) {
  if (existsSync(outPath)) {
    onProgress?.('Waveform already exists — skipping.');
    return;
  }
  await mkdir(dirname(outPath), { recursive: true });

  if (!duration) duration = await probeDuration(masterPath);
  const chunkDuration = duration / NUM_CHUNKS;

  onProgress?.(`  Extracting peaks in ${NUM_CHUNKS} parallel chunks…`);

  let completed = 0;
  const chunkPeaks = await Promise.all(
    Array.from({ length: NUM_CHUNKS }, (_, i) => {
      const start = i * chunkDuration;
      const end = i === NUM_CHUNKS - 1 ? duration : start + chunkDuration;
      return extractPeaks(masterPath, start, end - start).then((peaks) => {
        completed++;
        onProgress?.(`  Chunk ${completed}/${NUM_CHUNKS} done.`);
        return { i, peaks };
      });
    })
  );

  // Reassemble in order
  const allPeaks = chunkPeaks
    .sort((a, b) => a.i - b.i)
    .flatMap((c) => c.peaks);

  const peaks8 = new Array(allPeaks.length);
  for (let i = 0; i < allPeaks.length; i++) {
    peaks8[i] = Math.max(-128, Math.min(127, Math.round(allPeaks[i] / 256)));
  }

  const json = {
    version: 2,
    channels: 1,
    sample_rate: SAMPLE_RATE,
    samples_per_pixel: SAMPLES_PER_PIXEL,
    bits: 8,
    length: peaks8.length / 2,
    data: peaks8,
  };
  await writeFile(outPath, JSON.stringify(json));
  onProgress?.(`Wrote waveform: ${peaks8.length / 2} peak pairs.`);
}

function probeDuration(masterPath) {
  return new Promise((resolve, reject) => {
    const ff = spawnFfmpeg([
      '-v', 'error',
      '-i', masterPath,
      '-f', 'null', '-',
    ]);
    let stderr = '';
    ff.stderr.on('data', (d) => { stderr += d.toString(); });
    ff.on('error', reject);
    ff.on('close', () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
      if (!m) return reject(new Error('Could not determine duration'));
      resolve(parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]));
    });
  });
}

function extractPeaks(masterPath, start, duration) {
  return new Promise((resolve, reject) => {
    const ff = spawnFfmpeg([
      '-v', 'error',
      '-ss', String(start),
      '-t', String(duration),
      '-i', masterPath,
      '-ac', '1',
      '-ar', String(SAMPLE_RATE),
      '-f', 's16le',
      '-acodec', 'pcm_s16le',
      '-',
    ]);

    const peaks = [];
    let leftover = Buffer.alloc(0);
    let curMin = 32767;
    let curMax = -32768;
    let samplesInBucket = 0;

    ff.stdout.on('data', (chunk) => {
      const buf = leftover.length ? Buffer.concat([leftover, chunk]) : chunk;
      const fullSamples = Math.floor(buf.length / 2);
      leftover = buf.subarray(fullSamples * 2);

      for (let i = 0; i < fullSamples; i++) {
        const s = buf.readInt16LE(i * 2);
        if (s < curMin) curMin = s;
        if (s > curMax) curMax = s;
        samplesInBucket++;
        if (samplesInBucket >= SAMPLES_PER_PIXEL) {
          peaks.push(curMin, curMax);
          curMin = 32767;
          curMax = -32768;
          samplesInBucket = 0;
        }
      }
    });

    let stderr = '';
    ff.stderr.on('data', (d) => { stderr += d.toString(); });
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg waveform chunk failed: ${stderr.slice(-500)}`));
      if (samplesInBucket > 0) peaks.push(curMin, curMax);
      resolve(peaks);
    });
  });
}
