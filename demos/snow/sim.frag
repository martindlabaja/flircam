// Thawing snow — one ping-pong step.
// state: r = snow depth (0..1), g = heat, b = wet-ground memory
//
// Uniforms (u_dt, u_texel, mask(), and one u_<name> per param) come from the
// harness prelude — do not declare them here.

void main(){
  vec4 s = texture(u_prev, v_uv);
  float depth = s.r, heat = s.g, wet = s.b;
  vec2 px = u_texel;

  // heat: the silhouette is a heat source. It bleeds sideways so the melt runs
  // slightly ahead of the body, and cools off once the body moves on.
  float hb = 0.25 * ( texture(u_prev, v_uv + vec2(px.x, 0.0)).g
                    + texture(u_prev, v_uv - vec2(px.x, 0.0)).g
                    + texture(u_prev, v_uv + vec2(0.0, px.y)).g
                    + texture(u_prev, v_uv - vec2(0.0, px.y)).g );
  heat = mix(heat, hb, clamp(u_bleed * u_dt * 60.0, 0.0, 1.0));
  heat += mask() * u_heat * u_dt;
  heat -= heat * u_cool * u_dt;
  heat = clamp(heat, 0.0, 3.0);

  // snow: falls everywhere (with a little per-flake variation), melts under
  // heat, and slumps into its neighbours so edges round off instead of cliffing.
  // per-pixel, but constant in time — a time-varying rate lays down visible bands
  // wherever the silhouette sweeps across the field
  float flake = 0.7 + 0.6 * hash21(floor(v_uv * u_res / 3.0));
  depth += u_snowfall * u_dt * flake;
  depth -= heat * u_melt * u_dt;

  float db = 0.25 * ( texture(u_prev, v_uv + vec2(px.x, 0.0)).r
                    + texture(u_prev, v_uv - vec2(px.x, 0.0)).r
                    + texture(u_prev, v_uv + vec2(0.0, px.y)).r
                    + texture(u_prev, v_uv - vec2(0.0, px.y)).r );
  depth = mix(depth, db, clamp(u_slump * u_dt * 60.0, 0.0, 1.0));

  // cap the depth with smooth dunes, otherwise an untouched field saturates at 1.0
  // everywhere, the gradient goes flat and the shading pass has nothing to light
  float cap = 1.0 - u_dunes + u_dunes * fbm(v_uv * vec2(u_res.x / u_res.y, 1.0) * 6.0);
  depth = clamp(depth, 0.0, cap);

  // bare ground stays wet for a while after the snow has gone: that lingering
  // dark footprint is what sells the effect once the dancer has moved away.
  float w = clamp(heat * 1.5, 0.0, 1.0) * (1.0 - smoothstep(0.0, 0.15, depth));
  wet = max(w, wet - u_dry * u_dt);

  fragColor = vec4(depth, heat, wet, 1.0);
}
