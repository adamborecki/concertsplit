import { readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const PROJECT_FILENAME = 'project.json';

export async function loadProject(folder) {
  const path = join(folder, PROJECT_FILENAME);
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new Error(`Failed to read ${PROJECT_FILENAME}: ${err.message}`);
  }
}

export async function saveProject(folder, project) {
  const path = join(folder, PROJECT_FILENAME);
  await writeFile(path, JSON.stringify(project, null, 2) + '\n', 'utf8');
}

export function createProject({ name, masterFile }) {
  return {
    version: 1,
    project: {
      name,
      createdAt: new Date().toISOString(),
      masterFile,
    },
    sources: [
      { id: 'master', file: masterFile, offset: 0 },
    ],
    pieces: [],
  };
}

export async function folderExists(folder) {
  try {
    const s = await stat(folder);
    return s.isDirectory();
  } catch {
    return false;
  }
}
