// Fireflies — one ping-pong step.
// state: r = trail glow, g = presence field, ba = direction up that field.
//
// The flies themselves are stateless (see flies.frag); what the simulation
// carries is the field they steer by and the light they have left behind.

void main(){
  vec4 s = texture(u_prev, v_uv);
  vec2 px = u_texel;
  float fL = texture(u_prev, v_uv - vec2(px.x, 0.0)).g;
  float fR = texture(u_prev, v_uv + vec2(px.x, 0.0)).g;
  float fD = texture(u_prev, v_uv - vec2(0.0, px.y)).g;
  float fU = texture(u_prev, v_uv + vec2(0.0, px.y)).g;

  // presence: painted by the silhouette, blurred outwards so the pull reaches
  // past the body, and fading so the swarm follows instead of sticking
  float f = mix(s.g, 0.25 * (fL + fR + fD + fU), clamp(u_spread * u_dt * 60.0, 0.0, 1.0));
  f += mask() * u_rise * u_dt;
  f -= f * u_sink * u_dt;
  f = clamp(f, 0.0, 1.0);

  // gradient, kept as a direction only: magnitude here depends on the buffer
  // size, and the flies must not fly faster on a bigger window
  vec2 d = vec2(fR - fL, fU - fD);
  vec2 dir = d / (length(d) + 1e-5) * smoothstep(0.0, 0.004, length(d));

  vec3 light = flies(v_uv, 0.6, 0.0);                    // soft: this is the streak, not the fly
  float trail = max(s.r * exp(-u_fade * u_dt), max(light.r, max(light.g, light.b)));

  fragColor = vec4(trail, f, dir);
}
