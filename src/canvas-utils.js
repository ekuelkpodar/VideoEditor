export function makeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function cloneCanvas(source) {
  const canvas = makeCanvas(source.width, source.height);
  canvas.getContext("2d").drawImage(source, 0, 0);
  return canvas;
}

export function canvasFromImageBitmap(bitmap, maxEdge = 2400) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = makeCanvas(bitmap.width * scale, bitmap.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function blobFromCanvas(canvas, type = "image/png", quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error(`Could not encode ${type}`));
    }, type, quality);
  });
}

export function drawContain(target, source, background = "#15130f") {
  const ctx = target.getContext("2d");
  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, target.width, target.height);
  const scale = Math.min(target.width / source.width, target.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  const x = (target.width - width) / 2;
  const y = (target.height - height) / 2;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, x, y, width, height);
  ctx.restore();
}

export function resizeCanvas(source, width, height) {
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function cropCanvas(source, x, y, width, height) {
  const sx = clampNumber(x, 0, source.width - 1);
  const sy = clampNumber(y, 0, source.height - 1);
  const sw = clampNumber(width, 1, source.width - sx);
  const sh = clampNumber(height, 1, source.height - sy);
  const canvas = makeCanvas(sw, sh);
  canvas.getContext("2d").drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

export function rotateCanvas(source, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const quarterTurn = Math.abs(degrees) % 180 === 90;
  const canvas = makeCanvas(quarterTurn ? source.height : source.width, quarterTurn ? source.width : source.height);
  const ctx = canvas.getContext("2d");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

export function flipCanvas(source, axis) {
  const canvas = makeCanvas(source.width, source.height);
  const ctx = canvas.getContext("2d");
  ctx.translate(axis === "x" ? source.width : 0, axis === "y" ? source.height : 0);
  ctx.scale(axis === "x" ? -1 : 1, axis === "y" ? -1 : 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

export function applyPixelEffect(source, effect, options = {}) {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = image.data;
  const key = hexToRgb(options.keyColor || "#ffffff");
  const fuzz = Number(options.fuzz || 0);
  const brightness = Number(options.brightness || 0);
  const contrast = Number(options.contrast || 0);
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let index = 0; index < data.length; index += 4) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];

    if (effect === "grayscale") {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[index] = gray;
      data[index + 1] = gray;
      data[index + 2] = gray;
    }

    if (effect === "sepia") {
      data[index] = clampNumber(0.393 * r + 0.769 * g + 0.189 * b, 0, 255);
      data[index + 1] = clampNumber(0.349 * r + 0.686 * g + 0.168 * b, 0, 255);
      data[index + 2] = clampNumber(0.272 * r + 0.534 * g + 0.131 * b, 0, 255);
    }

    if (effect === "invert") {
      data[index] = 255 - r;
      data[index + 1] = 255 - g;
      data[index + 2] = 255 - b;
    }

    if (effect === "adjust") {
      data[index] = clampNumber(factor * (r - 128) + 128 + brightness, 0, 255);
      data[index + 1] = clampNumber(factor * (g - 128) + 128 + brightness, 0, 255);
      data[index + 2] = clampNumber(factor * (b - 128) + 128 + brightness, 0, 255);
    }

    if (effect === "remove-bg") {
      const distance = Math.hypot(r - key.r, g - key.g, b - key.b);
      if (distance <= fuzz) data[index + 3] = 0;
    }
  }

  ctx.putImageData(image, 0, 0);
  return effect === "halftone" ? halftoneCanvas(canvas) : canvas;
}

export function pixelateCanvas(source, size) {
  const block = Math.max(2, Number(size || 10));
  const canvas = makeCanvas(source.width, source.height);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const tiny = makeCanvas(Math.max(1, source.width / block), Math.max(1, source.height / block));
  tiny.getContext("2d").drawImage(source, 0, 0, tiny.width, tiny.height);
  ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function captionCanvas(source, caption) {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d");
  const size = Number(caption.size || 48);
  ctx.font = `700 ${size}px Georgia, serif`;
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size / 9);
  ctx.strokeStyle = caption.outline || "#111";
  ctx.fillStyle = caption.color || "#fff";
  ctx.strokeText(caption.text, Number(caption.x || 0), Number(caption.y || 0));
  ctx.fillText(caption.text, Number(caption.x || 0), Number(caption.y || 0));
  return canvas;
}

export function overlayCanvas(source, overlay, options = {}) {
  const canvas = cloneCanvas(source);
  const ctx = canvas.getContext("2d");
  const scale = Number(options.scale || 1);
  const width = overlay.width * scale;
  const height = overlay.height * scale;
  ctx.drawImage(overlay, Number(options.x || 0), Number(options.y || 0), width, height);
  return canvas;
}

export function makeSpriteSheet(frames, columns) {
  if (!frames.length) throw new Error("No frames loaded");
  const cols = Math.max(1, Number(columns || frames.length));
  const rows = Math.ceil(frames.length / cols);
  const width = frames[0].canvas.width;
  const height = frames[0].canvas.height;
  const sheet = makeCanvas(width * cols, height * rows);
  const ctx = sheet.getContext("2d");
  frames.forEach((frame, index) => {
    const x = (index % cols) * width;
    const y = Math.floor(index / cols) * height;
    ctx.drawImage(frame.canvas, x, y, width, height);
  });
  return sheet;
}

export function cutSpriteSheet(source, tileWidth, tileHeight) {
  const frames = [];
  const width = Math.max(1, Number(tileWidth));
  const height = Math.max(1, Number(tileHeight));
  const columns = Math.floor(source.width / width);
  const rows = Math.floor(source.height / height);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      frames.push({
        canvas: cropCanvas(source, x * width, y * height, width, height),
        delay: 120,
        name: `tile-${frames.length + 1}.png`
      });
    }
  }
  return frames;
}

export function makeStaticAnimation(source, mode = "zoom", count = 18, delay = 80) {
  return Array.from({ length: count }, (_, index) => {
    const t = index / Math.max(1, count - 1);
    const canvas = makeCanvas(source.width, source.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (mode === "rotate") {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(t * Math.PI * 2);
      ctx.drawImage(source, -source.width / 2, -source.height / 2);
    } else if (mode === "scroll") {
      const offset = Math.round(t * source.width);
      ctx.drawImage(source, -offset, 0);
      ctx.drawImage(source, source.width - offset, 0);
    } else {
      const scale = 1 + t * 0.2;
      const width = source.width * scale;
      const height = source.height * scale;
      ctx.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    }
    ctx.restore();
    return { canvas, delay, name: `${mode}-${index + 1}.png` };
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function halftoneCanvas(source) {
  const canvas = makeCanvas(source.width, source.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f8f0df";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  const step = Math.max(4, Math.round(Math.min(source.width, source.height) / 90));
  for (let y = 0; y < source.height; y += step) {
    for (let x = 0; x < source.width; x += step) {
      const [r, g, b, a] = sourceCtx.getImageData(x, y, 1, 1).data;
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const radius = ((1 - lum) * step) / 2;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
      ctx.beginPath();
      ctx.arc(x + step / 2, y + step / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}
