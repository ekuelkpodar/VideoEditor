import { blobFromCanvas, downloadBlob, drawContain, makeCanvas } from "./canvas-utils.js";

export async function exportCurrentFrame(frame, type, quality) {
  if (!frame) throw new Error("No current frame to export");
  const extension = type.split("/")[1].replace("jpeg", "jpg");
  const blob = await blobFromCanvas(frame.canvas, type, quality);
  downloadBlob(blob, `local-motion-frame.${extension}`);
}

export async function exportCanvasPng(canvas, filename) {
  const blob = await blobFromCanvas(canvas, "image/png", 1);
  downloadBlob(blob, filename);
}

export async function exportWebm(frames, options = {}) {
  if (!frames.length) throw new Error("No frames loaded");
  if (!HTMLCanvasElement.prototype.captureStream || !window.MediaRecorder) {
    throw new Error("This browser does not support MediaRecorder canvas export");
  }

  const width = frames[0].canvas.width;
  const height = frames[0].canvas.height;
  const canvas = makeCanvas(width, height);
  const stream = canvas.captureStream(Number(options.fps || 12));
  const mimeType = pickWebmMime();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  const done = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
  });

  recorder.start();
  const ctx = canvas.getContext("2d");
  for (const frame of frames) {
    drawContain(canvas, frame.canvas, "#000");
    ctx.drawImage(frame.canvas, 0, 0);
    await wait(Math.max(20, frame.delay || 120));
  }
  recorder.stop();
  const blob = await done;
  downloadBlob(blob, "local-motion-animation.webm");
}

export async function exportGifWithAdapter() {
  throw new Error("GIF export requires a configured gif.js or gifsicle-wasm adapter. See src/codecs.js.");
}

export async function runFfmpegAdapter() {
  throw new Error("ffmpeg.wasm is not installed in this repo. Add @ffmpeg/ffmpeg and implement runFfmpegAdapter in src/codecs.js.");
}

export async function runGifsicleAdapter() {
  throw new Error("gifsicle-wasm is not installed in this repo. Add @movable/gifsicle-wasm and implement runGifsicleAdapter in src/codecs.js.");
}

export async function runModernImageCodecAdapter(format) {
  throw new Error(`${format} requires a jSquash WASM package. Install the relevant @jsquash module and wire it here.`);
}

function pickWebmMime() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
