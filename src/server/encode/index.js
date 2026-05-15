import { mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { run, probe } from '../ffmpeg.js';
import { buildEncodePlan } from './build.js';

const OUTPUT_DIR = 'output';

let currentJob = null;

export function getJob() {
  return currentJob;
}

export async function startEncodeJob({ folder, project, force = false }) {
  if (currentJob && currentJob.state === 'running') {
    throw new Error('Encode already in progress');
  }

  const masterPath = join(folder, project.project.masterFile);
  const masterInfo = await probe(masterPath);
  const outputDir = join(folder, OUTPUT_DIR);
  await mkdir(outputDir, { recursive: true });

  const tasks = buildEncodePlan({ project, masterPath, masterInfo, outputDir });
  if (tasks.length === 0) {
    throw new Error('No segments to encode. Add at least one piece first.');
  }

  const job = {
    state: 'running',
    startedAt: new Date().toISOString(),
    completedAt: null,
    tasks: tasks.map((t) => ({
      id: t.id,
      kind: t.kind,
      status: 'pending',
      error: null,
    })),
  };
  currentJob = job;

  runTasksSequentially(tasks, job, { force }).catch((err) => {
    job.state = 'error';
    job.error = err.message;
    job.completedAt = new Date().toISOString();
  });

  return job;
}

async function runTasksSequentially(tasks, job, { force }) {
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const taskState = job.tasks[i];

    if (!force && existsSync(t.outputPath)) {
      try {
        const s = await stat(t.outputPath);
        if (s.size > 0) {
          taskState.status = 'skipped';
          continue;
        }
      } catch {}
    }

    taskState.status = 'running';
    try {
      await run('ffmpeg', t.args);
      taskState.status = 'done';
    } catch (err) {
      taskState.status = 'error';
      taskState.error = err.message;
    }
  }

  const anyError = job.tasks.some((t) => t.status === 'error');
  job.state = anyError ? 'partial' : 'done';
  job.completedAt = new Date().toISOString();
}
