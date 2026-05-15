const TARGET_WIDTH = 1920;
const TARGET_HEIGHT = 1080;
const TARGET_AUDIO_RATE = 44100;

export function buildEncodePlan({ project, masterPath, masterInfo, outputDir }) {
  const tasks = [];
  for (const piece of project.pieces || []) {
    const padded = String(piece.number).padStart(2, '0');
    tasks.push(...segmentTasks(piece, padded, { masterPath, masterInfo, outputDir }));
    for (const mv of piece.movements || []) {
      const name = `${padded}${mv.letter}`;
      tasks.push(...segmentTasks(mv, name, { masterPath, masterInfo, outputDir }));
    }
  }
  return tasks;
}

function segmentTasks(seg, baseName, { masterPath, masterInfo, outputDir }) {
  return [
    {
      id: `${baseName}.mp4`,
      kind: 'video',
      outputPath: `${outputDir}/${baseName}.mp4`,
      args: buildVideoArgs({ seg, masterPath, masterInfo, outputPath: `${outputDir}/${baseName}.mp4` }),
    },
    {
      id: `${baseName}.wav`,
      kind: 'audio',
      outputPath: `${outputDir}/${baseName}.wav`,
      args: buildAudioArgs({ seg, masterPath, outputPath: `${outputDir}/${baseName}.wav` }),
    },
  ];
}

function buildVideoArgs({ seg, masterPath, masterInfo, outputPath }) {
  const duration = seg.endTime - seg.startTime;
  const filters = [];

  // Zoom: crop + scale. Default zoom=1.0 means no crop, just scale to 1080p.
  const zoomLevel = seg.zoom?.level ?? 1.0;
  if (zoomLevel > 1.0 && masterInfo?.video) {
    const sw = masterInfo.video.width;
    const sh = masterInfo.video.height;
    const cw = Math.round(sw / zoomLevel);
    const ch = Math.round(sh / zoomLevel);
    const cx = Math.max(0, Math.min(sw - cw, Math.round((sw - cw) / 2 + (seg.zoom?.x ?? 0))));
    const cy = Math.max(0, Math.min(sh - ch, Math.round((sh - ch) / 2 + (seg.zoom?.y ?? 0))));
    filters.push(`crop=${cw}:${ch}:${cx}:${cy}`);
  }
  filters.push(`scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=decrease`);
  filters.push(`pad=${TARGET_WIDTH}:${TARGET_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black`);

  const videoFadeOut = seg.fades?.videoOut ?? 0;
  if (videoFadeOut > 0) {
    const fadeStart = Math.max(0, duration - videoFadeOut);
    filters.push(`fade=t=out:st=${fadeStart.toFixed(3)}:d=${videoFadeOut.toFixed(3)}`);
  }

  const audioFadeOut = seg.fades?.audioOut ?? 0;
  const audioFilters = audioFilterChain(seg, duration, audioFadeOut);

  return [
    '-v', 'error',
    '-y',
    '-ss', seg.startTime.toFixed(3),
    '-to', seg.endTime.toFixed(3),
    '-i', masterPath,
    '-vf', filters.join(','),
    ...(audioFilters.length ? ['-af', audioFilters.join(',')] : []),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    outputPath,
  ];
}

function buildAudioArgs({ seg, masterPath, outputPath }) {
  const duration = seg.endTime - seg.startTime;
  const audioFadeOut = seg.fades?.audioOut ?? 0;
  const filters = audioFilterChain(seg, duration, audioFadeOut);

  // Resample to 44.1kHz / 16-bit signed PCM. Add dither when going from higher bit depth.
  filters.push(`aresample=${TARGET_AUDIO_RATE}:dither_method=triangular`);
  filters.push('aformat=sample_fmts=s16');

  return [
    '-v', 'error',
    '-y',
    '-ss', seg.startTime.toFixed(3),
    '-to', seg.endTime.toFixed(3),
    '-i', masterPath,
    '-vn',
    '-af', filters.join(','),
    '-c:a', 'pcm_s16le',
    outputPath,
  ];
}

function audioFilterChain(seg, duration, audioFadeOut) {
  const filters = [];

  // Volume automation: each entry is a range and a gain (dB). The 'enable'
  // expression gates the filter to the range. Time is relative to the
  // trimmed input (starts at 0).
  for (const auto of seg.automation || []) {
    const startInSeg = Math.max(0, auto.startTime - seg.startTime);
    const endInSeg = Math.min(duration, auto.endTime - seg.startTime);
    if (endInSeg <= startInSeg) continue;
    const linear = Math.pow(10, (auto.gainDb || 0) / 20);
    filters.push(
      `volume=enable='between(t,${startInSeg.toFixed(3)},${endInSeg.toFixed(3)})':volume=${linear.toFixed(4)}`
    );
  }

  if (audioFadeOut > 0) {
    const fadeStart = Math.max(0, duration - audioFadeOut);
    filters.push(`afade=t=out:st=${fadeStart.toFixed(3)}:d=${audioFadeOut.toFixed(3)}`);
  }

  return filters;
}
