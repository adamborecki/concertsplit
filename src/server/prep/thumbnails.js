import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../ffmpeg.js';

const THUMBNAIL_INTERVAL_SEC = 10;
const THUMBNAIL_HEIGHT = 120;

export async function generateThumbnails({ masterPath, outDir, onProgress }) {
  await mkdir(outDir, { recursive: true });
  const existing = await readdir(outDir);
  if (existing.length > 0) {
    onProgress?.(`Thumbnails already exist (${existing.length} files) — skipping.`);
    return { interval: THUMBNAIL_INTERVAL_SEC, count: existing.length };
  }

  const pattern = join(outDir, 'thumb_%05d.jpg');
  await run('ffmpeg', [
    '-v', 'error',
    '-i', masterPath,
    '-vf', `fps=1/${THUMBNAIL_INTERVAL_SEC},scale=-2:${THUMBNAIL_HEIGHT}`,
    '-q:v', '4',
    pattern,
  ]);

  const written = await readdir(outDir);
  onProgress?.(`Wrote ${written.length} thumbnails.`);
  return { interval: THUMBNAIL_INTERVAL_SEC, count: written.length };
}

export { THUMBNAIL_INTERVAL_SEC, THUMBNAIL_HEIGHT };
