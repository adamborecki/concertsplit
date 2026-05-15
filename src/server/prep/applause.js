import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnFfmpeg } from '../ffmpeg.js';

const MIN_APPLAUSE_SEC = 3;
const MAX_APPLAUSE_SEC = 30;
const FLATNESS_THRESHOLD = 0.04;
const GAP_TOLERANCE_SEC = 0.5;

export async function detectApplause({ masterPath, outPath, onProgress }) {
  if (existsSync(outPath)) {
    onProgress?.('Applause candidates already exist — skipping.');
    return;
  }
  const series = await computeFlatnessSeries(masterPath, onProgress);
  const candidates = findSustainedFlatness(series);
  await writeFile(outPath, JSON.stringify(candidates, null, 2));
  onProgress?.(`Found ${candidates.length} applause candidate(s).`);
}

function computeFlatnessSeries(masterPath, onProgress) {
  return new Promise((resolve, reject) => {
    const ff = spawnFfmpeg([
      '-v', 'error',
      '-i', masterPath,
      '-af', 'aspectralstats=measure=flatness,ametadata=mode=print:file=-',
      '-f', 'null', '-',
    ]);

    const series = [];
    let pendingTime = null;
    let buffer = '';
    let lastReported = 0;

    ff.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        processLine(line);
      }
    });

    function processLine(line) {
      if (line.startsWith('frame:')) {
        const m = line.match(/pts_time:([\d.]+)/);
        if (m) pendingTime = parseFloat(m[1]);
      } else if (line.startsWith('lavfi.aspectralstats') && pendingTime !== null) {
        const m = line.match(/flatness=([\d.eE+-]+)/);
        if (m) {
          series.push({ t: pendingTime, flatness: parseFloat(m[1]) });
          if (onProgress && pendingTime - lastReported > 60) {
            onProgress(`  ${formatTime(pendingTime)} analyzed…`);
            lastReported = pendingTime;
          }
        }
      }
    }

    let stderr = '';
    ff.stderr.on('data', (d) => { stderr += d.toString(); });
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg flatness analysis failed: ${stderr.slice(-500)}`));
      if (buffer.trim()) processLine(buffer.trim());
      resolve(series);
    });
  });
}

function findSustainedFlatness(series) {
  if (series.length < 2) return [];
  const candidates = [];

  let runStart = -1;
  let runStartTime = 0;
  let lastAboveTime = 0;
  let flatnessSumInRun = 0;
  let countInRun = 0;

  const flush = (endTime) => {
    if (runStart < 0) return;
    const duration = endTime - runStartTime;
    if (duration >= MIN_APPLAUSE_SEC && duration <= MAX_APPLAUSE_SEC) {
      const meanFlatness = flatnessSumInRun / countInRun;
      candidates.push({
        startTime: round3(runStartTime),
        endTime: round3(endTime),
        confidence: confidenceFor(meanFlatness, duration),
      });
    }
    runStart = -1;
    flatnessSumInRun = 0;
    countInRun = 0;
  };

  for (let i = 0; i < series.length; i++) {
    const { t, flatness } = series[i];
    if (flatness >= FLATNESS_THRESHOLD) {
      if (runStart < 0) {
        runStart = i;
        runStartTime = t;
      }
      lastAboveTime = t;
      flatnessSumInRun += flatness;
      countInRun++;
    } else if (runStart >= 0) {
      if (t - lastAboveTime > GAP_TOLERANCE_SEC) {
        flush(lastAboveTime);
      }
    }
  }
  if (runStart >= 0) flush(lastAboveTime);
  return candidates;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function confidenceFor(meanFlatness, durationSec) {
  let c = 0.3;
  if (meanFlatness > 0.15) c += 0.4;
  else if (meanFlatness > 0.08) c += 0.25;
  else c += 0.1;
  if (durationSec >= 4 && durationSec <= 10) c += 0.2;
  return Math.min(1, round3(c));
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
