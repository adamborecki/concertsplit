import { spawn } from 'node:child_process';

export async function probe(filePath) {
  const out = await run('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);
  const data = JSON.parse(out.stdout);
  const audio = data.streams.find((s) => s.codec_type === 'audio');
  const video = data.streams.find((s) => s.codec_type === 'video');
  return {
    duration: parseFloat(data.format.duration),
    audio: audio
      ? {
          codec: audio.codec_name,
          sampleRate: parseInt(audio.sample_rate, 10),
          channels: audio.channels,
        }
      : null,
    video: video
      ? {
          codec: video.codec_name,
          width: video.width,
          height: video.height,
          fps: evalFps(video.r_frame_rate),
        }
      : null,
  };
}

function evalFps(rate) {
  if (!rate) return null;
  const [n, d] = rate.split('/').map(Number);
  return d ? n / d : n;
}

export function run(cmd, args, { onStderr } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      if (onStderr) onStderr(s);
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

export function spawnFfmpeg(args) {
  return spawn('ffmpeg', args);
}
