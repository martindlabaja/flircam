// Flowering meadow — one ping-pong step.
// state: r = bloom (how open the flowers here are), g = touch (where the body
//        has been lately), b = age since this patch opened
//
// The flowers themselves are drawn procedurally in render.frag; this buffer only
// says how open they are, so the sim can run at a fraction of the canvas.

void main(){
  vec4 s = texture(u_prev, v_uv);
  vec2 px = u_texel;
  vec4 nL = texture(u_prev, v_uv - vec2(px.x, 0.0));
  vec4 nR = texture(u_prev, v_uv + vec2(px.x, 0.0));
  vec4 nD = texture(u_prev, v_uv - vec2(0.0, px.y));
  vec4 nU = texture(u_prev, v_uv + vec2(0.0, px.y));

  // touch: the silhouette waters the meadow, and the trace fades behind it
  float t = mix(s.g, 0.25 * (nL.g + nR.g + nD.g + nU.g), clamp(u_spread * u_dt * 60.0, 0.0, 1.0));
  t += mask() * u_rise * u_dt;
  t -= t * u_sink * u_dt;
  t = clamp(t, 0.0, 1.0);

  // some patches are more fertile than others, so a swept arm never leaves a
  // stamped rectangle of identical flowers
  float fert = 0.5 + 1.0 * fbm(v_uv * vec2(u_res.x / u_res.y, 1.0) * 4.0);
  float bloom = s.r + smoothstep(u_thresh, u_thresh + 0.15, t) * u_grow * fert * u_dt;
  bloom -= u_wilt * u_dt;                       // always creeping back to plain grass

  // blooms seed their neighbours, a touch weaker each step, so a patch spreads
  // outwards and then stops instead of taking the whole field
  float avg = 0.25 * (nL.r + nR.r + nD.r + nU.r);
  bloom = mix(bloom, max(bloom, avg * 0.985), clamp(u_creep * u_dt * 60.0, 0.0, 1.0));
  bloom = clamp(bloom, 0.0, 1.0);

  // age deepens the colour of a flower that has been open a while, and resets
  // once the patch has gone back to grass
  float age = s.b + u_dt * (0.12 * step(0.15, bloom) - 0.6 * step(bloom, 0.02));
  fragColor = vec4(bloom, t, clamp(age, 0.0, 1.0), 1.0);
}
