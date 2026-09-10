// Frame source for the demos: the Pi's MJPEG mask, a local webcam, or a synthetic
// test pattern. Always resolves to something — the demos must run with the Pi off.
//
// MJPEG note: a multipart/x-mixed-replace <img> fires `load` only for the first
// frame, so we just re-upload the element every rAF and let the browser's decoder
// keep it current. Cross-origin upload into a texture needs the
// Access-Control-Allow-Origin header that pi/mask.py sends.

export const SRC_KEY = "flircam.src";
export const PI_URL = "http://192.168.1.235:8080/stream.mjpg";

export function savedSrc() {
  return new URLSearchParams(location.search).get("src") || localStorage.getItem(SRC_KEY) || "test";
}

function texture(gl) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function loadImg(url, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => { img.src = ""; reject(new Error("timeout")); }, timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error("load failed (offline, or missing CORS header)")); };
    img.src = url;
  });
}

async function webcam() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
  const v = document.createElement("video");
  v.srcObject = stream; v.muted = true; v.playsInline = true;
  await v.play();
  return v;
}

// A moving silhouette so the melt/particle behaviour is visible with no camera.
function testPattern() {
  const c = document.createElement("canvas");
  c.width = 640; c.height = 480;
  const g = c.getContext("2d");
  c._draw = (t) => {
    g.fillStyle = "#000";
    g.fillRect(0, 0, 640, 480);
    g.fillStyle = "#fff";
    const blob = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    const x = 320 + Math.sin(t * 0.7) * 190, y = 280 + Math.sin(t * 1.1) * 60;
    blob(x, y, 46);                                    // body
    blob(x + Math.sin(t * 2.2) * 26, y - 70, 26);      // head
    g.save();                                          // sweeping arm
    g.translate(x, y - 20);
    g.rotate(Math.sin(t * 1.7) * 1.2);
    g.fillRect(-8, 0, 16, 120);
    g.restore();
    blob(120 + Math.sin(t * 0.31) * 80, 120, 30);      // second figure, slower
  };
  return c;
}

export class Source {
  constructor(gl, el, kind, note = "") {
    // note: shown in the panel — the stream URL when it worked, why it did not
    // when it did not. `warn` is only set when we fell back to the test pattern.
    this.gl = gl; this.el = el; this.kind = kind; this.note = note; this.warn = "";
    this.tex = texture(gl);
    this.width = 0; this.height = 0;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // image rows are top-down, uv is bottom-up
  }

  static async create(gl, src = savedSrc()) {
    let warn = "";
    if (src === "webcam") {
      try { return new Source(gl, await webcam(), "webcam"); }
      catch (e) { warn = "webcam refused — " + e.message; }
    } else if (src && src !== "test") {
      try { return new Source(gl, await loadImg(src), "mjpeg", src); }
      catch (e) { warn = "stream unreachable — " + e.message; }
    }
    if (warn) console.warn(warn);
    const s = new Source(gl, testPattern(), "test", warn);
    s.warn = warn;
    return s;
  }

  update(time) {
    const gl = this.gl, el = this.el;
    if (this.kind === "test") el._draw(time);
    const w = el.naturalWidth || el.videoWidth || el.width;
    const h = el.naturalHeight || el.videoHeight || el.height;
    if (!w || !h) return;
    if (this.kind === "webcam" && el.readyState < 2) return;
    this.width = w; this.height = h;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);
  }

  get label() {
    const dim = this.width ? ` ${this.width}x${this.height}` : "";
    return `${this.kind}${dim}${this.note ? " — " + this.note : ""}`;
  }
}
