import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { probe } from '../ffmpeg.js';
import { generateWaveform } from './waveform.js';
import { generateThumbnails } from './thumbnails.js';
import { detectApplause } from './applause.js';

const POSTPROD_DIR = '.postprod';

export async function runPrep({ folder, masterFile, onProgress = console.log }) {
  const masterPath = join(folder, masterFile);
  const postprodDir = join(folder, POSTPROD_DIR);
  await mkdir(postprodDir, { recursive: true });

  onProgress(`Probing ${masterFile}…`);
  const info = await probe(masterPath);
  onProgress(
    `  Duration: ${formatTime(info.duration)} | ` +
    `Video: ${info.video ? `${info.video.codec} ${info.video.width}x${info.video.height}@${info.video.fps?.toFixed(1)}fps` : 'none'} | ` +
    `Audio: ${info.audio ? `${info.audio.codec} ${info.audio.sampleRate}Hz ${info.audio.channels}ch` : 'none'}`
  );

  if (!info.audio) throw new Error(`No audio track found in ${masterFile}.`);

  onProgress('\nGenerating waveform peaks…');
  await generateWaveform({
    masterPath,
    outPath: join(postprodDir, 'waveform.json'),
    onProgress,
  });

  onProgress('\nGenerating thumbnails…');
  await generateThumbnails({
    masterPath,
    outDir: join(postprodDir, 'thumbnails'),
    onProgress,
  });

  onProgress('\nDetecting applause candidates…');
  await detectApplause({
    masterPath,
    outPath: join(postprodDir, 'applause-candidates.json'),
    onProgress,
  });

  onProgress('\nPrep complete.');
  return { duration: info.duration, info };
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

export { POSTPROD_DIR };
