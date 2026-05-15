import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnFfmpeg } from '../ffmpeg.js';

// Tuned against labeled concert data (F1=0.889, recall=16/17).
// Applause sits in a moderate flatness band with low short-term variance,
// while music swings between very low (quiet) and very high (dense textures).
const FLAT_LOW = 0.12;
const FLAT_HIGH = 0.20;
const STD_MAX = 0.06;
const WINDOW_SEC = 3.0;       // rolling window for mean/std
const MIN_APPLAUSE_SEC = 5;
const MAX_APPLAUSE_SEC = 30;
const GAP_TOLERANCE_SEC = 0.3;

export async function detectApplause({ masterPath, outPath, onProgress }) {
  if (existsSync(outPath)) {
    onProgress?.('Applause candidates already exist — skipping.');
    return;
  }
  const series = await computeFlatnessSeries(masterPath, onProgress);
  const candidates = findApplauseRegions(series);
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
          pendingTime = null;
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

function findApplauseRegions(series) {
  if (series.length < 2) return [];

  // Compute rolling mean and std over WINDOW_SEC for each frame
  const half = WINDOW_SEC / 2;
  let lo = 0;
  let hi = 0;
  let sum = 0;
  let sumSq = 0;

  const smoothed = series.map((frame, i) => {
    const { t } = frame;
    // Advance hi pointer
    while (hi < series.length && series[hi].t <= t + half) {
      sum += series[hi].flatness;
      sumSq += series[hi].flatness ** 2;
      hi++;
    }
    // Advance lo pointer
    while (lo < i && series[lo].t < t - half) {
      sum -= series[lo].flatness;
      sumSq -= series[lo].flatness ** 2;
      lo++;
    }
    const n = hi - lo;
    const mean = sum / n;
    const variance = Math.max(0, sumSq / n - mean ** 2);
    return { t, mean, std: Math.sqrt(variance) };
  });

  // Detect sustained regions where mean is in band and std is low
  const candidates = [];
  let runStart = -1;
  let runStartTime = 0;
  let lastInTime = 0;
  let runMeanSum = 0;
  let runCount = 0;

  const flush = (endTime) => {
    if (runStart < 0) return;
    const duration = endTime - runStartTime;
    if (duration >= MIN_APPLAUSE_SEC && duration <= MAX_APPLAUSE_SEC) {
      candidates.push({
        startTime: round3(runStartTime),
        endTime: round3(endTime),
        confidence: round3(Math.min(1, 0.5 + (runMeanSum / runCount - FLAT_LOW) / (FLAT_HIGH - FLAT_LOW) * 0.5)),
      });
    }
    runStart = -1;
    runMeanSum = 0;
    runCount = 0;
  };

  for (let i = 0; i < smoothed.length; i++) {
    const { t, mean, std } = smoothed[i];
    const inBand = mean >= FLAT_LOW && mean <= FLAT_HIGH && std <= STD_MAX;
    if (inBand) {
      if (runStart < 0) { runStart = i; runStartTime = t; }
      lastInTime = t;
      runMeanSum += mean;
      runCount++;
    } else if (runStart >= 0 && t - lastInTime > GAP_TOLERANCE_SEC) {
      flush(lastInTime);
    }
  }
  if (runStart >= 0) flush(lastInTime);

  return candidates;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
