// Buffer A — where the gold is. iChannel0 = itself; the mask comes via maskTex.
//   r  flow  gold on the move: fed by the body, running texel by texel along the veins
//   g  gold  what the flow has reached; tarnishes away over minutes
//   b  heat  fresh gold is white-hot, cools to metal
//   a  warm  a glow that hugs the body

void mainImage(out vec4 O, in vec2 F){
  vec2 R = iResolution.xy, uv = F / R, tx = 1.0 / R;
  vec4 s = iFrame < 2 ? vec4(0.0) : texture(iChannel0, uv);
  float dt = iTimeDelta;
  float m = maskTex(uv);

  // idle drips: a bead of gold lands somewhere now and then, so an empty floor
  // still has something running through it
  if (u_drip > 0.0){
    float period = 6.0 / u_drip, k = floor(iTime / period);
    vec2 q = hash22(vec2(k, 17.0)) * 0.8 + 0.1;
    float on = 1.0 - smoothstep(0.06, 0.10, fract(iTime / period));
    float dd = length((uv - q) * vec2(R.x / R.y, 1.0)) * FLOOR;
    m = max(m, 0.6 * on * (1.0 - smoothstep(0.06, 0.12, dd)));
  }

  // can gold run through this texel, and how much of it survives the step. Not
  // every crack takes gold: a share of the borders at each scale lose it within a
  // few texels, so the gold branches and dead-ends instead of filling the net
  const vec3 OPEN = vec3(0.70, 0.50, 1.0);
  vec2 p = world(uv, R);
  float tw = FLOOR / R.y;
  float keep = 0.0;
  for (int i = 0; i < 3; i++){
    vec4 e = crack(p, i);
    if (e.x < max(veinWidth(p, i), 0.7 * tw)){
      float k = 1.0 - LOSS[i] / max(u_reach, 0.05);
      if (e.w > OPEN[i]) k *= 0.82;
      keep = max(keep, k);
    }
  }

  float nb = 0.0, nw = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec4 t = texture(iChannel0, uv + vec2(i, j) * tx);
    nb = max(nb, t.r); nw = max(nw, t.a);
  }

  // gold advances a texel at a time: the front crosses into a dark texel on a
  // coin toss (`flow` is the pace, and the jitter it puts on the front is what
  // makes it look poured rather than drawn), but a lit texel refreshes from its
  // neighbours every frame, so the falloff along a vein is exactly keep^n and does
  // not depend on the framerate
  float cand = nb * keep;
  bool lit = s.r > 0.01;
  bool adv = lit || hash12(F * 0.37 + mod(float(iFrame), 1024.0) * vec2(0.113, 0.071)) < u_flow;
  // a front just got here (or a stronger one came through): only counts once
  // the gold is enough to show, or the far trickles flicker hot for ever
  float arrive = (adv && cand > 2.0 * s.r + 0.08) ? 1.0 : 0.0;
  float flow = s.r * exp(-dt / max(u_linger, 0.05));  // dies once it is cut off from a source
  if (adv) flow = max(flow, cand);
  flow = max(flow, m);

  float heat = max(max(s.b * exp(-dt / 2.5), arrive), m);
  float gold = max(s.g * exp(-dt / max(u_fade, 1.0)), flow);
  // the glow spreads like the flow but through everything, losing most of itself
  // per texel, so it hugs the silhouette
  float warm = max(max(s.a * exp(-dt / 0.7), nw * 0.94), m);

  O = vec4(flow, gold, heat, warm);
}
