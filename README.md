# concertsplit

A local web app for splitting classical concert recordings into individual pieces and movements. Mark segment boundaries in the browser, set fades and zoom, then export per-segment video and audio files via FFmpeg.

## Requirements

- [Node.js](https://nodejs.org) v18+
- [FFmpeg](https://ffmpeg.org) (must be on your PATH)

## Setup

```bash
git clone https://github.com/adamborecki/post-production-webapp.git
cd post-production-webapp
npm install
npm run build
```

## Running

Point it at a folder containing your concert video file:

```bash
node bin/concertsplit.js /path/to/concert-folder
```

On first run it will ask you to pick the master video file and enter a project name, then create a `project.json` in that folder. On subsequent runs it loads the existing project automatically.

The app opens in your browser automatically. Prep work (waveform, thumbnails, applause detection) runs in the terminal before the browser opens — this takes a few minutes for a full concert.

## Workflow

1. **Mark pieces** — click **+ Piece** at the start of each piece, scrub to the end, click **Set End**
2. **Mark movements** — select a piece, click **+ Movement** for each movement within it
3. **Adjust boundaries** — drag segment handles on the waveform, or edit start/end times in the inspector
4. **Set fades** — audio and video fade-out durations per segment in the inspector
5. **Encode** — click **Encode** to generate per-segment `.mp4` and `.wav` files in `output/`

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / pause |
| `P` | Add piece |
| `V` | Add movement |
| `E` | Set end point (while in set-end mode) |
| `←` / `→` | Scrub 1s (+ `Shift` = 0.1s) |
| `+` / `−` | Zoom in / out |
| `0` | Jump to start |
| `⌫` | Remove selected segment |

## Output

Files are written to `output/` inside your concert folder:

- `01.mp4` / `01.wav` — Piece 1
- `01a.mp4` / `01a.wav` — Piece 1, Movement A
- `02.mp4` / `02.wav` — Piece 2
- etc.

Video is H.264 1080p. Audio is WAV 44.1kHz 16-bit. Already-encoded segments are skipped unless you click **Re-encode all**.
