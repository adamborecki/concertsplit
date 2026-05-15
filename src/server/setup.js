import { readdir } from 'node:fs/promises';
import { basename, resolve, join } from 'node:path';
import prompts from 'prompts';
import { loadProject, saveProject, createProject, folderExists } from './project.js';

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.avi', '.mxf', '.m4v'];

function isVideoFile(name) {
  const lower = name.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

async function findVideoFiles(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  return entries.filter((e) => e.isFile() && isVideoFile(e.name)).map((e) => e.name);
}

async function promptForFolder() {
  const { folder } = await prompts({
    type: 'text',
    name: 'folder',
    message: 'Path to the concert folder (the one with the master video file):',
    validate: async (input) => {
      const resolved = resolve(input);
      if (!(await folderExists(resolved))) return `Folder does not exist: ${resolved}`;
      return true;
    },
  });
  if (!folder) throw new Error('No folder provided.');
  return resolve(folder);
}

async function promptForMaster(folder) {
  const candidates = await findVideoFiles(folder);
  if (candidates.length === 0) {
    throw new Error(`No video files (${VIDEO_EXTENSIONS.join(', ')}) found in ${folder}.`);
  }
  if (candidates.length === 1) {
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Use ${candidates[0]} as the master file?`,
      initial: true,
    });
    if (!confirm) throw new Error('Setup cancelled.');
    return candidates[0];
  }
  const { master } = await prompts({
    type: 'select',
    name: 'master',
    message: 'Which file is the master?',
    choices: candidates.map((c) => ({ title: c, value: c })),
  });
  if (!master) throw new Error('No master file selected.');
  return master;
}

async function promptForName(defaultName) {
  const { name } = await prompts({
    type: 'text',
    name: 'name',
    message: 'Project name:',
    initial: defaultName,
  });
  if (!name) throw new Error('No project name provided.');
  return name;
}

export async function runSetup(initialFolder) {
  const folder = initialFolder ?? (await promptForFolder());

  if (!(await folderExists(folder))) {
    throw new Error(`Folder does not exist: ${folder}`);
  }

  const existing = await loadProject(folder);
  if (existing) {
    console.log(`Loaded existing project: ${existing.project.name}`);
    return { folder, data: existing };
  }

  console.log(`No project.json found in ${folder} — let's create one.\n`);
  const masterFile = await promptForMaster(folder);
  const name = await promptForName(basename(folder));
  const data = createProject({ name, masterFile });
  await saveProject(folder, data);
  console.log(`\nCreated ${join(folder, 'project.json')}.`);
  return { folder, data };
}
