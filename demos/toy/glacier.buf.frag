// Buffer A — the ice sheet, in plan view. iChannel0 = itself, iChannel1 = mask.
// The silhouette snows ice onto the map, the ice creeps outward (a diffusion
// step, which is what glacier flow looks like from above), and it melts
// everywhere — so a dancer builds a range that slumps behind them.

// The camera's aspect, recovered from the cover-fit the harness hands us. The
// ice map is a rectangle of that shape on the ground, so the whole camera frame
// lands on it uncropped and the body keeps its proportions.
float srcAR(){ return (u_res.x / u_res.y) * u_maskFit.y / u_maskFit.x; }

// the mask straight off iChannel1 — no fit, the map already has its aspect
float maskRaw(vec2 uv){
  if (u_mirror > 0.5) uv.x = 1.0 - uv.x;
  float v = texture(iChannel1, uv).r;
  return u_invert > 0.5 ? 1.0 - v : v;
}

void mainImage(out vec4 O, in vec2 F){
  vec2 R = iResolution.xy, uv = F / R;

  // buffer texels are not square in world units, so tap at world-equal offsets:
  // otherwise the ice creeps faster across the map than along it
  float k = (R.x / R.y) / srcAR();
  vec2 e = vec2(max(k, 1.0), max(1.0 / k, 1.0)) / R;

  vec4 s = texture(iChannel0, uv);
  float l = texture(iChannel0, uv - vec2(e.x, 0.0)).r;
  float r = texture(iChannel0, uv + vec2(e.x, 0.0)).r;
  float d = texture(iChannel0, uv - vec2(0.0, e.y)).r;
  float u = texture(iChannel0, uv + vec2(0.0, e.y)).r;

  float h = mix(s.r, 0.25 * (l + r + d + u), clamp(u_creep * iTimeDelta * 60.0, 0.0, 1.0));
  float m = maskRaw(uv);
  // deposition slows as the ice deepens, so a body standing still rounds off at
  // accum/(accum+melt) instead of piling up to the clamp and giving a flat mesa
  h += m * u_accum * (1.0 - h) * iTimeDelta;
  h -= h * u_melt * iTimeDelta;

  // fresh snow: stays bright for a few seconds where the body just was
  float fresh = max(s.g - iTimeDelta * 0.4, m);

  O = vec4(clamp(h, 0.0, 1.0), clamp(fresh, 0.0, 1.0), 0.0, 1.0);
}
