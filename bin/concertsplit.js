#!/usr/bin/env node
import { resolve } from 'node:path';
import { runSetup } from '../src/server/setup.js';
import { startServer } from '../src/server/index.js';
import { runPrep } from '../src/server/prep/index.js';
import open from 'open';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`concertsplit — split a classical concert recording into pieces and movements

Usage:
  concertsplit                    Interactive setup (prompts for folder)
  concertsplit <folder>           Open project in the given folder
  concertsplit --help             Show this help

The folder should contain the master video file. concertsplit will create a
project.json there to track your edits, plus a .postprod/ directory for
generated waveform data and thumbnails, and an output/ directory for the
final encoded segments.
`);
  process.exit(0);
}

const folderArg = args[0];
const folder = folderArg ? resolve(folderArg) : null;

try {
  const project = await runSetup(folder);
  await runPrep({
    folder: project.folder,
    masterFile: project.data.project.masterFile,
  });
  const { url } = await startServer(project);
  console.log(`\nconcertsplit is running at ${url}`);
  console.log('Press Ctrl+C to stop.');
  try {
    await open(url);
  } catch {
    console.log('(Could not auto-open browser — open the URL above manually.)');
  }
} catch (err) {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
}
