import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../ffmpeg.js';

const THUMBNAIL_INTERVAL_SEC = 10;
const THUMBNAIL_HEIGHT = 120;

export async function generateThumbnails({ masterPath, outDir, duration, onProgress }) {
  await mkdir(outDir, { recursive: true });
  const existing = await readdir(outDir);
  if (existing.length > 0) {
    onProgress?.(`Thumbnails already exist (${existing.length} files) — skipping.`);
    return { interval: THUMBNAIL_INTERVAL_SEC, count: existing.length };
  }

  const times = [];
  for (let t = 0; !duration || t <= duration; t += THUMBNAIL_INTERVAL_SEC) {
    times.push(t);
    if (duration && t + THUMBNAIL_INTERVAL_SEC > duration) break;
  }
  const total = times.length;
  let done = 0;
  const CONCURRENCY = 50;

  for (let i = 0; i < times.length; i += CONCURRENCY) {
    const batch = times.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (t, bi) => {
      const n = i + bi + 1;
      const outFile = join(outDir, `thumb_${String(n).padStart(5, '0')}.jpg`);
      await run('ffmpeg', [
        '-v', 'error',
        '-ss', String(t),
        '-i', masterPath,
        '-frames:v', '1',
        '-vf', `scale=-2:${THUMBNAIL_HEIGHT}`,
        '-q:v', '4',
        outFile,
      ]);
      done++;
      onProgress?.(`  Thumbnail ${done}/${total}…`);
    }));
  }

  onProgress?.(`Wrote ${done} thumbnails.`);
  return { interval: THUMBNAIL_INTERVAL_SEC, count: done };
}

export { THUMBNAIL_INTERVAL_SEC, THUMBNAIL_HEIGHT };
