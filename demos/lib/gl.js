// Minimal WebGL2 helpers: fullscreen-triangle passes, float targets, ping-pong.
// Zero dependencies — the browser loads these files straight off disk, no build step.

const VS = `#version 300 es
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main(){ v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;

export function createGL(canvas) {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false });
  if (!gl) throw new Error("WebGL2 unavailable — open this in Chrome/Edge on Windows, not a WSL browser.");
  // float render targets: the sim state needs more than 8 bits per channel
  if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("EXT_color_buffer_float missing");

  // one fullscreen triangle, reused by every pass
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  gl._quad = vao;
  return gl;
}

function compile(gl, type, src, label) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`${label}\n${log}`);
  }
  return s;
}

export class Program {
  constructor(gl, fragSrc, label = "shader") {
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, VS, label + " (vertex)");
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc, label);
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error(`${label} (link)\n${log}`);
    }
    this.p = p;
    // introspect so callers can pass a plain object and we set the right glUniform*
    this.u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, "");
      this.u[name] = { loc: gl.getUniformLocation(p, name), type: info.type };
    }
  }

  // Uniform names not present in the shader are ignored, so the harness can
  // shotgun every global at every pass without each shader having to use them.
  draw(uniforms) {
    const gl = this.gl;
    gl.useProgram(this.p);
    let unit = 0;
    for (const name in uniforms) {
      const u = this.u[name];
      if (!u) continue;
      let v = uniforms[name];
      if (v == null) continue;
      if (v instanceof WebGLTexture) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, v);
        gl.uniform1i(u.loc, unit++);
      } else if (typeof v === "boolean" || typeof v === "number") {
        v = +v;
        if (u.type === gl.FLOAT) gl.uniform1f(u.loc, v);
        else gl.uniform1i(u.loc, v | 0);
      } else if (v.length === 2) gl.uniform2fv(u.loc, v);
      else if (v.length === 3) gl.uniform3fv(u.loc, v);
      else if (v.length === 4) gl.uniform4fv(u.loc, v);
    }
    gl.bindVertexArray(gl._quad);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  dispose() { this.gl.deleteProgram(this.p); }
}

const FORMATS = {
  rgba16f: ["RGBA16F", "RGBA", "HALF_FLOAT"],
  rgba32f: ["RGBA32F", "RGBA", "FLOAT"],
  rgba8: ["RGBA8", "RGBA", "UNSIGNED_BYTE"],
};

export class Target {
  constructor(gl, w, h, format = "rgba16f") {
    this.gl = gl; this.w = w; this.h = h; this.format = format;
    const [ifmt, fmt, type] = FORMATS[format];
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl[ifmt], w, h, 0, gl[fmt], gl[type], null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  bind() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.w, this.h);
  }

  clear(c = [0, 0, 0, 1]) {
    const gl = this.gl;
    this.bind();
    gl.clearColor(c[0], c[1], c[2], c[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  dispose() { this.gl.deleteTexture(this.tex); this.gl.deleteFramebuffer(this.fbo); }
}

export class PingPong {
  constructor(gl, w, h, format = "rgba16f") {
    this.gl = gl; this.format = format;
    this.a = new Target(gl, w, h, format);
    this.b = new Target(gl, w, h, format);
  }
  get read() { return this.a; }
  get write() { return this.b; }
  get w() { return this.a.w; }
  get h() { return this.a.h; }
  swap() { const t = this.a; this.a = this.b; this.b = t; }
  clear(c) { this.a.clear(c); this.b.clear(c); }

  // Resize without losing the simulation: blit the old state into the new buffers.
  resize(w, h, copyProg) {
    if (w === this.w && h === this.h) return;
    const gl = this.gl;
    const old = this.a;
    const next = new PingPong(gl, w, h, this.format);
    next.a.bind();
    copyProg.draw({ u_state: old.tex, u_prev: old.tex });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.a.dispose(); this.b.dispose();
    this.a = next.a; this.b = next.b;
  }

  dispose() { this.a.dispose(); this.b.dispose(); }
}
