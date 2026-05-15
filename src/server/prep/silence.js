import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnFfmpeg } from '../ffmpeg.js';

// Silence below this dB level for at least MIN_SILENCE_SEC is a candidate boundary.
const SILENCE_DB = -40;
const MIN_SILENCE_SEC = 0.8;
// A piece boundary is likely when silence follows applause or precedes music after a gap.
// We emit the midpoint of each silence region as a suggested boundary.

export async function detectSilence({ masterPath, outPath, onProgress }) {
  if (existsSync(outPath)) {
    onProgress?.('Silence candidates already exist — skipping.');
    return;
  }
  const regions = await computeSilenceRegions(masterPath, onProgress);
  await writeFile(outPath, JSON.stringify(regions, null, 2));
  onProgress?.(`Found ${regions.length} silence region(s).`);
}

function computeSilenceRegions(masterPath, onProgress) {
  return new Promise((resolve, reject) => {
    const ff = spawnFfmpeg([
      '-v', 'error',
      '-i', masterPath,
      '-af', `silencedetect=noise=${SILENCE_DB}dB:duration=${MIN_SILENCE_SEC}`,
      '-f', 'null', '-',
    ]);

    const regions = [];
    let currentStart = null;
    let buffer = '';
    let lastReported = 0;

    ff.stderr.on('data', (chunk) => {
      buffer += chunk.toString();
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);

        const startM = line.match(/silence_start:\s*([\d.]+)/);
        const endM = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/);

        if (startM) {
          currentStart = parseFloat(startM[1]);
          const t = currentStart;
          if (onProgress && t - lastReported > 60) {
            onProgress(`  ${formatTime(t)} analyzed…`);
            lastReported = t;
          }
        }
        if (endM && currentStart !== null) {
          const endTime = parseFloat(endM[1]);
          const duration = parseFloat(endM[2]);
          regions.push({
            startTime: round3(currentStart),
            endTime: round3(endTime),
            duration: round3(duration),
            midTime: round3((currentStart + endTime) / 2),
          });
          currentStart = null;
        }
      }
    });

    ff.stdout.on('data', () => {});
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg silence detection failed`));
      resolve(regions);
    });
  });
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
