import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnFfmpeg } from '../ffmpeg.js';

const SAMPLE_RATE = 22050;
const SAMPLES_PER_PIXEL = 256;

export async function generateWaveform({ masterPath, outPath, onProgress }) {
  if (existsSync(outPath)) {
    onProgress?.('Waveform already exists — skipping.');
    return;
  }
  await mkdir(dirname(outPath), { recursive: true });

  const peaks = await extractPeaks(masterPath, onProgress);
  // peaks.js JSON format requires 8-bit values (-128..127); binary .dat supports 16-bit.
  const peaks8 = new Array(peaks.length);
  for (let i = 0; i < peaks.length; i++) peaks8[i] = Math.max(-128, Math.min(127, Math.round(peaks[i] / 256)));
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

function extractPeaks(masterPath, onProgress) {
  return new Promise((resolve, reject) => {
    const ff = spawnFfmpeg([
      '-v', 'error',
      '-i', masterPath,
      '-ac', '1',
      '-ar', String(SAMPLE_RATE),
      '-f', 's16le',
      '-acodec', 'pcm_s16le',
      '-',
    ]);

    const peaks = [];
    let leftover = Buffer.alloc(0);
    let sampleCount = 0;
    let lastReported = 0;

    let curMin = 32767;
    let curMax = -32768;
    let samplesInBucket = 0;

    ff.stdout.on('data', (chunk) => {
      const buf = leftover.length ? Buffer.concat([leftover, chunk]) : chunk;
      const fullSamples = Math.floor(buf.length / 2);
      const bytesUsed = fullSamples * 2;
      leftover = buf.subarray(bytesUsed);

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
      sampleCount += fullSamples;
      const seconds = sampleCount / SAMPLE_RATE;
      if (onProgress && seconds - lastReported > 60) {
        onProgress(`  ${formatTime(seconds)} processed…`);
        lastReported = seconds;
      }
    });

    let stderr = '';
    ff.stderr.on('data', (d) => { stderr += d.toString(); });
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg waveform extraction failed: ${stderr.slice(-500)}`));
      if (samplesInBucket > 0) peaks.push(curMin, curMax);
      resolve(peaks);
    });
  });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
