import {
  applyPixelEffect,
  blobFromCanvas,
  canvasFromImageBitmap,
  captionCanvas,
  cloneCanvas,
  cropCanvas,
  cutSpriteSheet,
  downloadBlob,
  drawContain,
  flipCanvas,
  makeCanvas,
  makeSpriteSheet,
  makeStaticAnimation,
  overlayCanvas,
  pixelateCanvas,
  resizeCanvas,
  rotateCanvas
} from "./canvas-utils.js";
import { exportCanvasPng, exportCurrentFrame, exportGifWithAdapter, exportWebm, runFfmpegAdapter } from "./codecs.js";

const state = {
  frames: [],
  current: 0,
  playing: false,
  timer: null,
  lastVideoFile: null,
  loopCount: 0,
  overlayCanvas: null
};

const elements = {
  browseButton: document.querySelector("#browseButton"),
  fileInput: document.querySelector("#fileInput"),
  dropzone: document.querySelector("#dropzone"),
  previewCanvas: document.querySelector("#previewCanvas"),
  frameSlider: document.querySelector("#frameSlider"),
  frameReadout: document.querySelector("#frameReadout"),
  frameStrip: document.querySelector("#frameStrip"),
  frameSummary: document.querySelector("#frameSummary"),
  projectTitle: document.querySelector("#projectTitle"),
  runtimeStatus: document.querySelector("#runtimeStatus"),
  log: document.querySelector("#log"),
  playButton: document.querySelector("#playButton"),
  stopButton: document.querySelector("#stopButton"),
  clearButton: document.querySelector("#clearButton")
};

const toolNames = {
  import: "Import",
  maker: "Animation Maker",
  transform: "Transform",
  effects: "Effects",
  text: "Text Overlay",
  frames: "Frames & Sprite",
  video: "Video Tools",
  optimize: "Optimize"
};

boot();

function boot() {
  bindNavigation();
  bindImport();
  bindPlayback();
  bindMaker();
  bindTransforms();
  bindEffects();
  bindText();
  bindFrames();
  bindVideo();
  bindOptimize();
  render();
  log("Load files to begin. Canvas operations are active; WASM codec adapters are explicit extension points.");
}

function bindNavigation() {
  document.querySelectorAll(".tool-nav button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tool-nav button").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".tool-view").forEach((view) => view.classList.remove("active"));
      button.classList.add("active");
      document.querySelector(`[data-view="${button.dataset.tool}"]`).classList.add("active");
      document.querySelector("#toolTitle").textContent = toolNames[button.dataset.tool];
    });
  });
}

function bindImport() {
  elements.browseButton.addEventListener("click", () => elements.fileInput.click());
  elements.fileInput.addEventListener("change", async () => loadFiles([...elements.fileInput.files]));

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    elements.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropzone.classList.remove("dragging");
    });
  });

  elements.dropzone.addEventListener("drop", async (event) => {
    await loadFiles([...event.dataTransfer.files]);
  });

  document.querySelector("#sampleVideoButton").addEventListener("click", async () => {
    if (!state.lastVideoFile) return;
    await sampleVideo(state.lastVideoFile, {
      fps: Number(document.querySelector("#videoFps").value),
      maxSeconds: Number(document.querySelector("#videoSeconds").value)
    });
  });
}

function bindPlayback() {
  elements.playButton.addEventListener("click", play);
  elements.stopButton.addEventListener("click", stop);
  elements.clearButton.addEventListener("click", () => {
    stop();
    state.frames = [];
    state.current = 0;
    state.lastVideoFile = null;
    render();
    log("Cleared project.");
  });
  elements.frameSlider.addEventListener("input", () => {
    state.current = Number(elements.frameSlider.value);
    renderPreview();
    highlightActiveFrame();
  });
}

function bindMaker() {
  document.querySelector("#applyDelayButton").addEventListener("click", () => {
    const delay = Number(document.querySelector("#delayInput").value);
    state.loopCount = Number(document.querySelector("#loopInput").value);
    mutateFrames((frame) => ({ ...frame, delay }));
    log(`Applied ${delay}ms delay to ${state.frames.length} frames.`);
  });

  document.querySelector("#reverseButton").addEventListener("click", () => {
    state.frames.reverse();
    state.current = 0;
    render();
    log("Reversed frame order.");
  });

  document.querySelector("#pingPongButton").addEventListener("click", () => {
    if (state.frames.length < 2) return;
    const tail = state.frames.slice(1, -1).reverse().map(cloneFrame);
    state.frames = [...state.frames, ...tail];
    render();
    log("Created ping-pong animation sequence.");
  });

  document.querySelector("#shuffleButton").addEventListener("click", () => {
    for (let i = state.frames.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.frames[i], state.frames[j]] = [state.frames[j], state.frames[i]];
    }
    render();
    log("Shuffled frames.");
  });

  document.querySelector("#staticAnimationButton").addEventListener("click", () => {
    const frame = currentFrame();
    if (!frame) {
      log("No still frame loaded.");
      return;
    }
    state.frames = makeStaticAnimation(
      frame.canvas,
      document.querySelector("#staticMode").value,
      Number(document.querySelector("#staticFrameCount").value),
      Number(document.querySelector("#delayInput").value)
    );
    state.current = 0;
    render();
    log(`Generated ${state.frames.length} ${document.querySelector("#staticMode").value} animation frames.`);
  });

  document.querySelector("#exportWebmButton").addEventListener("click", async () => runTask("Exporting WebM", () => exportWebm(state.frames)));
  document.querySelector("#exportGifButton").addEventListener("click", async () => runTask("Exporting GIF", () => exportGifWithAdapter(state.frames)));
}

function bindTransforms() {
  document.querySelector("#resizeButton").addEventListener("click", () => {
    const width = Number(document.querySelector("#resizeWidth").value);
    const height = Number(document.querySelector("#resizeHeight").value);
    mutateFrames((frame) => ({ ...frame, canvas: resizeCanvas(frame.canvas, width, height) }));
    log(`Resized frames to ${width}x${height}.`);
  });

  document.querySelector("#cropButton").addEventListener("click", () => {
    const x = Number(document.querySelector("#cropX").value);
    const y = Number(document.querySelector("#cropY").value);
    const width = Number(document.querySelector("#cropW").value);
    const height = Number(document.querySelector("#cropH").value);
    mutateFrames((frame) => ({ ...frame, canvas: cropCanvas(frame.canvas, x, y, width, height) }));
    log(`Cropped frames to ${width}x${height} from ${x},${y}.`);
  });

  document.querySelectorAll("[data-rotate]").forEach((button) => {
    button.addEventListener("click", () => {
      const degrees = Number(button.dataset.rotate);
      mutateFrames((frame) => ({ ...frame, canvas: rotateCanvas(frame.canvas, degrees) }));
      log(`Rotated frames ${degrees} degrees.`);
    });
  });

  document.querySelectorAll("[data-flip]").forEach((button) => {
    button.addEventListener("click", () => {
      mutateFrames((frame) => ({ ...frame, canvas: flipCanvas(frame.canvas, button.dataset.flip) }));
      log(`Flipped frames on ${button.dataset.flip.toUpperCase()} axis.`);
    });
  });

  document.querySelector("#trimButton").addEventListener("click", () => {
    const start = Number(document.querySelector("#trimStart").value);
    const endInput = Number(document.querySelector("#trimEnd").value);
    const end = endInput > 0 ? endInput + 1 : state.frames.length;
    state.frames = state.frames.slice(start, end);
    state.current = 0;
    render();
    log(`Trimmed to ${state.frames.length} frames.`);
  });
}

function bindEffects() {
  document.querySelectorAll("[data-effect]").forEach((button) => {
    button.addEventListener("click", () => {
      mutateFrames((frame) => ({ ...frame, canvas: applyPixelEffect(frame.canvas, button.dataset.effect) }));
      log(`Applied ${button.dataset.effect} effect.`);
    });
  });

  document.querySelector("#adjustButton").addEventListener("click", () => {
    const brightness = Number(document.querySelector("#brightnessInput").value);
    const contrast = Number(document.querySelector("#contrastInput").value);
    mutateFrames((frame) => ({ ...frame, canvas: applyPixelEffect(frame.canvas, "adjust", { brightness, contrast }) }));
    log(`Adjusted brightness ${brightness}, contrast ${contrast}.`);
  });

  document.querySelector("#pixelateButton").addEventListener("click", () => {
    const size = Number(document.querySelector("#pixelSize").value);
    mutateFrames((frame) => ({ ...frame, canvas: pixelateCanvas(frame.canvas, size) }));
    log(`Pixelated frames with ${size}px blocks.`);
  });

  document.querySelector("#removeBgButton").addEventListener("click", () => {
    const keyColor = document.querySelector("#keyColor").value;
    const fuzz = Number(document.querySelector("#fuzzInput").value);
    mutateFrames((frame) => ({ ...frame, canvas: applyPixelEffect(frame.canvas, "remove-bg", { keyColor, fuzz }) }));
    log(`Removed background near ${keyColor} with fuzz ${fuzz}.`);
  });
}

function bindText() {
  document.querySelector("#overlayInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    state.overlayCanvas = canvasFromImageBitmap(bitmap);
    log(`Overlay loaded: ${file.name}.`);
  });

  document.querySelector("#captionButton").addEventListener("click", () => {
    const caption = {
      text: document.querySelector("#captionText").value,
      size: Number(document.querySelector("#captionSize").value),
      x: Number(document.querySelector("#captionX").value),
      y: Number(document.querySelector("#captionY").value),
      color: document.querySelector("#captionColor").value,
      outline: document.querySelector("#captionOutline").value
    };
    const start = Number(document.querySelector("#captionStart").value);
    const endInput = Number(document.querySelector("#captionEnd").value);
    const end = endInput > 0 ? endInput : state.frames.length - 1;
    mutateFrames((frame, index) => index >= start && index <= end ? { ...frame, canvas: captionCanvas(frame.canvas, caption) } : frame);
    log(`Applied caption to frames ${start}-${end}.`);
  });

  document.querySelector("#overlayButton").addEventListener("click", () => {
    if (!state.overlayCanvas) {
      log("Choose an overlay image first.");
      return;
    }
    const scale = Number(document.querySelector("#overlayScale").value) / 100;
    const x = Number(document.querySelector("#overlayX").value);
    const y = Number(document.querySelector("#overlayY").value);
    mutateFrames((frame) => ({ ...frame, canvas: overlayCanvas(frame.canvas, state.overlayCanvas, { x, y, scale }) }));
    log("Applied overlay to all frames.");
  });
}

function bindFrames() {
  document.querySelector("#extractButton").addEventListener("click", renderFrameStrip);
  document.querySelector("#spriteButton").addEventListener("click", async () => {
    await runTask("Generating sprite", async () => {
      const sheet = makeSpriteSheet(state.frames, Number(document.querySelector("#spriteColumns").value));
      await exportCanvasPng(sheet, "local-motion-sprite.png");
    });
  });
  document.querySelector("#cutSpriteButton").addEventListener("click", () => {
    const frame = currentFrame();
    if (!frame) return;
    state.frames = cutSpriteSheet(frame.canvas, Number(document.querySelector("#tileWidth").value), Number(document.querySelector("#tileHeight").value));
    state.current = 0;
    render();
    log(`Cut sprite sheet into ${state.frames.length} tiles.`);
  });
  document.querySelector("#exportPngButton").addEventListener("click", async () => runTask("Exporting PNG", () => exportCurrentFrame(currentFrame(), "image/png", 1)));
}

function bindVideo() {
  document.querySelector("#transcodeButton").addEventListener("click", async () => {
    await runTask("Running ffmpeg adapter", () => runFfmpegAdapter({
      file: state.lastVideoFile,
      start: Number(document.querySelector("#videoStart").value),
      duration: Number(document.querySelector("#videoDuration").value),
      width: Number(document.querySelector("#videoWidth").value),
      fps: Number(document.querySelector("#videoToolFps").value)
    }));
  });
}

function bindOptimize() {
  document.querySelector("#rasterExportButton").addEventListener("click", async () => {
    const type = document.querySelector("#rasterFormat").value;
    const quality = Number(document.querySelector("#qualityInput").value);
    await runTask("Exporting still", () => exportCurrentFrame(currentFrame(), type, quality));
  });
}

async function loadFiles(files) {
  if (!files.length) return;
  stop();
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));
  const videoFiles = files.filter((file) => file.type.startsWith("video/"));

  if (videoFiles[0]) {
    state.lastVideoFile = videoFiles[0];
    document.querySelector("#sampleVideoButton").disabled = false;
    log(`Video selected: ${videoFiles[0].name}. Use Sample Selected Video to create editable frames.`);
  }

  if (!imageFiles.length) {
    render();
    return;
  }

  await runTask("Loading images", async () => {
    const loaded = [];
    for (const file of imageFiles) {
      loaded.push(await frameFromImageFile(file));
    }
    state.frames = loaded;
    state.current = 0;
    applyInitialDimensions();
    render();
    log(`Loaded ${loaded.length} image frame${loaded.length === 1 ? "" : "s"}. Animated image files decode as first-frame previews unless a WASM decoder is wired.`);
  });
}

async function frameFromImageFile(file) {
  const bitmap = await createImageBitmap(file);
  return {
    canvas: canvasFromImageBitmap(bitmap),
    delay: Number(document.querySelector("#delayInput")?.value || 120),
    name: file.name
  };
}

async function sampleVideo(file, options) {
  await runTask("Sampling video", async () => {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.src = URL.createObjectURL(file);
    await once(video, "loadedmetadata");

    const duration = Math.min(video.duration || options.maxSeconds, options.maxSeconds);
    const fps = Math.max(1, Number(options.fps || 8));
    const count = Math.max(1, Math.floor(duration * fps));
    const sample = makeCanvas(video.videoWidth, video.videoHeight);
    const ctx = sample.getContext("2d");
    const frames = [];

    for (let index = 0; index < count; index += 1) {
      video.currentTime = (index / fps);
      await once(video, "seeked");
      ctx.drawImage(video, 0, 0, sample.width, sample.height);
      frames.push({
        canvas: cloneCanvas(sample),
        delay: Math.round(1000 / fps),
        name: `${file.name}-frame-${index + 1}.png`
      });
      elements.runtimeStatus.textContent = `Sampling ${index + 1}/${count}`;
    }

    URL.revokeObjectURL(video.src);
    state.frames = frames;
    state.current = 0;
    applyInitialDimensions();
    render();
    log(`Sampled ${frames.length} frames from ${file.name}.`);
  });
}

function render() {
  const hasFrames = state.frames.length > 0;
  elements.playButton.disabled = !hasFrames;
  elements.stopButton.disabled = !hasFrames;
  elements.frameSlider.disabled = !hasFrames;
  elements.frameSlider.max = Math.max(0, state.frames.length - 1);
  elements.frameSlider.value = state.current;
  elements.frameReadout.textContent = hasFrames ? `${state.current + 1} / ${state.frames.length}` : "0 / 0";
  elements.frameSummary.textContent = hasFrames ? `${state.frames.length} frame${state.frames.length === 1 ? "" : "s"}` : "No frames";
  elements.projectTitle.textContent = hasFrames ? state.frames[state.current].name : "No media loaded";
  renderPreview();
  renderFrameStrip();
}

function renderPreview() {
  const frame = currentFrame();
  const canvas = elements.previewCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!frame) {
    ctx.fillStyle = "#15130f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff4cf";
    ctx.font = "32px Georgia, serif";
    ctx.fillText("Drop media to begin", 40, 70);
    return;
  }
  drawContain(canvas, frame.canvas);
  elements.frameSlider.value = state.current;
  elements.frameReadout.textContent = `${state.current + 1} / ${state.frames.length}`;
  elements.projectTitle.textContent = frame.name;
}

function renderFrameStrip() {
  elements.frameStrip.innerHTML = "";
  state.frames.forEach((frame, index) => {
    const card = document.createElement("article");
    card.className = `frame-card${index === state.current ? " active" : ""}`;
    const thumb = makeCanvas(180, 126);
    drawContain(thumb, frame.canvas, "#f8f0df");
    const label = document.createElement("span");
    label.textContent = `${index + 1}. ${frame.canvas.width}x${frame.canvas.height} · ${frame.delay || 120}ms`;
    const actions = document.createElement("div");
    actions.className = "mini-actions";
    const select = document.createElement("button");
    select.textContent = "Select";
    select.addEventListener("click", () => {
      state.current = index;
      render();
    });
    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      state.frames.splice(index, 1);
      state.current = Math.max(0, Math.min(state.current, state.frames.length - 1));
      render();
    });
    actions.append(select, remove);
    card.append(thumb, label, actions);
    elements.frameStrip.append(card);
  });
}

function highlightActiveFrame() {
  document.querySelectorAll(".frame-card").forEach((card, index) => {
    card.classList.toggle("active", index === state.current);
  });
}

function play() {
  if (!state.frames.length || state.playing) return;
  state.playing = true;
  elements.runtimeStatus.textContent = "Playing";
  const tick = () => {
    if (!state.playing) return;
    renderPreview();
    highlightActiveFrame();
    const delay = currentFrame()?.delay || 120;
    state.current = (state.current + 1) % state.frames.length;
    state.timer = setTimeout(tick, delay);
  };
  tick();
}

function stop() {
  state.playing = false;
  clearTimeout(state.timer);
  elements.runtimeStatus.textContent = "Canvas ready";
}

function mutateFrames(mutator) {
  if (!state.frames.length) {
    log("No frames loaded.");
    return;
  }
  stop();
  state.frames = state.frames.map((frame, index) => mutator(frame, index));
  state.current = Math.min(state.current, state.frames.length - 1);
  applyInitialDimensions();
  render();
}

async function runTask(label, task) {
  try {
    elements.runtimeStatus.textContent = label;
    await task();
    elements.runtimeStatus.textContent = "Canvas ready";
  } catch (error) {
    elements.runtimeStatus.textContent = "Needs adapter";
    log(error.message);
  }
}

function applyInitialDimensions() {
  const frame = currentFrame();
  if (!frame) return;
  document.querySelector("#resizeWidth").value = frame.canvas.width;
  document.querySelector("#resizeHeight").value = frame.canvas.height;
  document.querySelector("#cropW").value = frame.canvas.width;
  document.querySelector("#cropH").value = frame.canvas.height;
  document.querySelector("#trimEnd").value = Math.max(0, state.frames.length - 1);
  document.querySelector("#captionEnd").value = Math.max(0, state.frames.length - 1);
}

function currentFrame() {
  return state.frames[state.current];
}

function cloneFrame(frame) {
  return {
    ...frame,
    canvas: cloneCanvas(frame.canvas)
  };
}

function log(message) {
  elements.log.textContent = message;
}

function once(target, eventName) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(eventName, handleEvent);
      target.removeEventListener("error", handleError);
    };
    const handleEvent = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error(`Failed while waiting for ${eventName}`));
    };
    target.addEventListener(eventName, handleEvent, { once: true });
    target.addEventListener("error", handleError, { once: true });
  });
}
