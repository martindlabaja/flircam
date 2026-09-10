// Tiny slider panel. Every param becomes a `u_<name>` uniform in the shaders,
// so a demo declares its knobs once in main.js and never wires them up again.
// Values persist per demo so a look you liked survives a reload.

const CSS = `
#panel{position:fixed;top:0;right:0;width:250px;max-height:100vh;overflow:auto;z-index:9;
 background:#14161acc;backdrop-filter:blur(6px);color:#dfe3ea;font:11px ui-monospace,monospace;
 padding:10px 12px;border-left:1px solid #ffffff1a}
#panel h1{font-size:12px;margin:0 0 8px;letter-spacing:.08em;text-transform:uppercase;color:#8ab4ff}
#panel .row{margin:7px 0}
#panel label{display:flex;justify-content:space-between;gap:8px;color:#98a2b3}
#panel b{color:#dfe3ea;font-weight:500}
#panel input[type=range]{width:100%;accent-color:#8ab4ff;height:14px;margin:2px 0 0}
#panel input[type=checkbox]{accent-color:#8ab4ff}
#panel .foot{margin-top:10px;padding-top:8px;border-top:1px solid #ffffff1a;color:#6b7280;line-height:1.55}
#panel button{background:#ffffff12;border:1px solid #ffffff1f;color:#dfe3ea;font:inherit;
 padding:3px 8px;border-radius:4px;cursor:pointer}
#panel button:hover{background:#ffffff22}
#stat{color:#6b7280}
`;

export class Params {
  constructor(defs, key) {
    this.defs = defs;
    this.key = "flircam.params." + key;
    this.values = {};
    for (const n in defs) this.values[n] = defs[n].v;
    try { Object.assign(this.values, JSON.parse(localStorage.getItem(this.key) || "{}")); } catch {}
  }

  save() { try { localStorage.setItem(this.key, JSON.stringify(this.values)); } catch {} }

  reset() {
    for (const n in this.defs) this.values[n] = this.defs[n].v;
    this.save();
    this.sync();
  }

  uniforms(into = {}) {
    for (const n in this.values) into["u_" + n] = this.values[n];
    return into;
  }

  // Builds the panel; `title` heads it, `help` is the key legend under it.
  mount(title, help) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.append(style);

    const el = document.createElement("div");
    el.id = "panel";
    el.innerHTML = `<h1>${title}</h1>`;
    this.el = el;
    this.inputs = {};

    for (const n in this.defs) {
      const d = this.defs[n];
      const row = document.createElement("div");
      row.className = "row";
      const bool = typeof d.v === "boolean";
      const id = "p_" + n;
      if (bool) {
        row.innerHTML = `<label for="${id}">${d.label || n}<input type="checkbox" id="${id}"></label>`;
      } else {
        row.innerHTML = `<label for="${id}">${d.label || n}<b id="v_${n}"></b></label>
          <input type="range" id="${id}" min="${d.min}" max="${d.max}" step="${d.step}">`;
      }
      el.append(row);
      const input = row.querySelector("input");
      this.inputs[n] = input;
      input.addEventListener("input", () => {
        this.values[n] = bool ? input.checked : parseFloat(input.value);
        if (!bool) el.querySelector("#v_" + n).textContent = this.fmt(this.values[n]);
        this.save();
      });
    }

    const foot = document.createElement("div");
    foot.className = "foot";
    foot.innerHTML = `<div id="stat"></div><div>${help}</div>
      <div style="margin-top:6px"><button id="reset">reset params</button></div>`;
    el.append(foot);
    foot.querySelector("#reset").onclick = () => this.reset();
    this.stat = foot.querySelector("#stat");
    document.body.append(el);
    this.sync();
    return el;
  }

  fmt(v) { return Math.abs(v) >= 100 || Number.isInteger(v) ? String(v) : v.toPrecision(3); }

  sync() {
    for (const n in this.inputs) {
      const v = this.values[n], input = this.inputs[n];
      if (typeof v === "boolean") input.checked = v;
      else { input.value = v; this.el.querySelector("#v_" + n).textContent = this.fmt(v); }
    }
  }

  toggle() { this.el.hidden = !this.el.hidden; }
}
