// Thawing snow — shading pass. Reads the sim state, writes the screen.

void main(){
  vec4 s = texture(u_state, v_uv);
  float depth = s.r, heat = s.g, wet = s.b;

  if (u_view > 0.5) {                                   // 1 depth, 2 heat, 3 mask
    if (u_view < 1.5) { fragColor = vec4(vec3(depth), 1.0); return; }
    if (u_view < 2.5) { fragColor = vec4(vec3(heat / 3.0), 1.0); return; }
    fragColor = vec4(vec3(mask()), 1.0); return;
  }

  // normal from the depth gradient — this is what makes the drift read as 3D
  vec2 px = u_stateTexel;
  float hL = texture(u_state, v_uv - vec2(px.x, 0.0)).r;
  float hR = texture(u_state, v_uv + vec2(px.x, 0.0)).r;
  float hD = texture(u_state, v_uv - vec2(0.0, px.y)).r;
  float hU = texture(u_state, v_uv + vec2(0.0, px.y)).r;
  vec3 n = normalize(vec3((hL - hR) * u_relief, (hD - hU) * u_relief, 0.05));
  vec3 L = normalize(vec3(-0.5, 0.55, 0.65));
  float lam = clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0);    // half-lambert: no black shadows

  // ground under the snow
  vec2 gp = v_uv * vec2(u_res.x / u_res.y, 1.0);
  float g = fbm(gp * 18.0);
  vec3 ground = mix(vec3(0.16, 0.15, 0.135), vec3(0.31, 0.285, 0.245), g);
  ground = mix(ground, ground * 0.55 + vec3(0.02, 0.028, 0.038), wet);   // wet: darker, cooler
  ground += wet * 0.10 * pow(1.0 - abs(v_uv.y - 0.55) * 2.0, 4.0);   // wet sheen

  // snow: blue in shadow, white where lit, slushy grey where it is melting
  vec3 snow = mix(vec3(0.42, 0.50, 0.68), vec3(0.93, 0.95, 1.00), lam);
  vec2 sc = v_uv * u_res * 0.12;                                            // sparse round glints
  float tw = hash21(floor(sc) + floor(u_time * 3.0));
  float glint = pow(tw, 70.0) * smoothstep(0.45, 0.0, length(fract(sc) - 0.5));
  snow += glint * 3.0 * u_sparkle * lam * smoothstep(0.25, 0.6, depth);
  snow = mix(snow, vec3(0.62, 0.66, 0.72), clamp(heat, 0.0, 1.0) * 0.5);

  float cover = smoothstep(0.0, max(u_edge, 0.001), depth);
  vec3 col = mix(ground, snow, cover);
  col *= 1.0 - 0.45 * u_wetrim * cover * (1.0 - smoothstep(u_edge, u_edge * 3.0, depth)); // dark melt line

  fragColor = vec4(col, 1.0);
}
