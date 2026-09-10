// Image — the floor, seen by the projector straight down. iChannel0 = Buffer A.
//
// Kintsugi: the pottery repair that fills the cracks with gold. Here the body is
// the impact. Where someone stands, molten gold pours into the fracture network
// and runs outward along it; the front glows white-hot, cools to metal behind,
// and the veins tarnish away over minutes — a slow map of where everyone was.

// blackbody-ish: dull red, orange, white-gold
vec3 heatCol(float h){ return h * 1.6 * mix(vec3(1.2, 0.18, 0.02), vec3(2.2, 1.5, 0.9), pow(h, 2.5)); }

void mainImage(out vec4 O, in vec2 F){
  vec2 R = iResolution.xy, uv = F / R;
  vec2 tx = u_stateTexel;
  vec4 s = texture(iChannel0, uv);
  // a vein is one texel wide in Buffer A and a couple of pixels here, so take the
  // max over the neighbouring texels: bilinear would dim it from either side
  vec3 g = s.rgb;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++)
    g = max(g, texture(iChannel0, uv + vec2(i, j) * tx).rgb);
  float flow = g.r, gold = g.g, heat = g.b, warm = s.a;

  if (u_view > 0.5){                            // 1 Buffer A, 2 the mask, 3 the fracture network
    if (u_view < 1.5){ O = vec4(g, 1.0); return; }
    if (u_view < 2.5){ O = vec4(vec3(maskTex(uv)), 1.0); return; }
  }

  vec2 p = world(uv, R);
  float pw = FLOOR / R.y;                       // one pixel, in world units

  // the body is a pool of molten gold that sets a couple of seconds after they go
  float pool = s.b * smoothstep(0.0, 0.5, s.r);

  // the veins: a bead of gold lying in each crack, the coarse network on top. A
  // thin trickle is a narrower bead, not a dimmer one, so the veins taper toward
  // their ends; the hairline crazing only fills inside the molten pool
  float hgt = 0.0, cover = 0.0, slope = 0.0, vis = 0.0;
  vec2 nrm = vec2(0.0);
  for (int i = 0; i < 3; i++){
    vec4 e = crack(p, i);
    float w = veinWidth(p, i);
    float v = smoothstep(0.02, 0.06, gold);
    if (i < 2) w *= mix(0.35, 1.0, smoothstep(0.05, 0.6, gold));
    else v = smoothstep(0.3, 0.7, pool);
    float c = 1.0 - smoothstep(w - pw, w + pw, e.x);
    cover = max(cover, 1.0 - smoothstep(veinWidth(p, i) - pw, veinWidth(p, i) + pw, e.x));
    if (c <= 0.0 || v <= 0.0) continue;
    float x = min(e.x / w, 0.98), bead = sqrt(1.0 - x * x);
    float h = bead * c * v * (1.0 - 0.25 * float(i));
    if (h > hgt){ hgt = h; nrm = e.yz; slope = 0.9 * x / bead; vis = c * v; }
  }
  if (u_view > 2.5){ O = vec4(vec3(cover), 1.0); return; }

  // gold: a strong key light sweeping slowly, a fake studio window in the
  // reflection so the two flanks of a bead never match, and a pin highlight
  vec3 N = normalize(vec3(-nrm * slope, 1.0));
  float a = iTime * 0.25;
  vec3 L = normalize(vec3(0.7 * cos(a), 0.7 * sin(a), 0.75));
  vec3 V = vec3(0.0, 0.0, 1.0), H = normalize(L + V);
  float ndl = max(dot(N, L), 0.0), ndh = max(dot(N, H), 0.0);
  vec3 F0 = vec3(1.0, 0.55, 0.13);              // rich gold, in linear light
  // the window sits off-axis so a vein running either way gets a bright and a dark flank
  float env = smoothstep(-1.0, 1.0, dot(reflect(-V, N).xy, vec2(0.6, 0.8)));
  vec3 metal = F0 * (0.45 + 0.35 * ndl + 0.6 * env)
             + F0 * pow(ndh, 30.0) * 0.8
             + vec3(1.0, 0.9, 0.7) * pow(ndh, 250.0) * 2.0;

  vec3 hot = heatCol(heat) * smoothstep(0.0, 0.08, flow);
  // gold falls off geometrically with distance run, so -log(gold) is the distance
  // along the vein: light pulses ride outward on it
  float pd = -log(max(gold, 1e-4));
  float pulse = pow(0.5 + 0.5 * cos(pd * 6.0 - iTime * 5.0), 24.0) * u_pulse;
  vec3 vein = metal + hot + pulse * vec3(1.2, 0.8, 0.4);

  // the plates: near-black glaze, the crazing barely there, a warm glow around
  // the body, and the body itself a pool of molten gold that sets after they go
  vec3 base = vec3(0.0025, 0.0032, 0.0048) + cover * vec3(0.004, 0.004, 0.005);
  vec3 halo = vec3(0.45, 0.12, 0.02) * warm * warm * u_glow;
  float shimmer = vnoise(p * 5.0 + vec2(iTime * 0.5, iTime * 0.2)) * vnoise(p * 11.0 - vec2(iTime * 0.3, iTime * 0.6));
  vec3 poolCol = mix(vec3(1.6, 0.45, 0.06), vec3(3.0, 1.6, 0.5), shimmer) * pool * u_pool;
  vec3 col = base + halo + poolCol;
  col = mix(col, vein + poolCol * 0.3, vis);

  col = 1.0 - exp(-col * u_gain);
  col = pow(max(col, 0.0), vec3(0.4545));       // real lighting, so gamma out
  O = vec4(col, 1.0);
}
