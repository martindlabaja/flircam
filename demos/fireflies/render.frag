// Fireflies — shading pass. Near-black background on purpose: on a projector,
// black is "no light", so only the flies and their trails land on the room.

void main(){
  vec4 s = texture(u_state, v_uv);
  float trail = s.r, f = s.g;

  if (u_view > 0.5) {                                  // 1 presence, 2 trail, 3 mask
    if (u_view < 1.5) { fragColor = vec4(vec3(f), 1.0); return; }
    if (u_view < 2.5) { fragColor = vec4(vec3(trail), 1.0); return; }
    fragColor = vec4(vec3(mask()), 1.0); return;
  }

  vec2 gp = v_uv * aspect();
  float haze = fbm(gp * 2.2 + vec2(u_time * 0.02, u_time * 0.01));
  vec3 col = mix(vec3(0.010, 0.018, 0.028), vec3(0.030, 0.052, 0.050), haze)
           * (0.45 + 0.55 * v_uv.y) * u_mist;          // night, thinning towards the ground

  col += vec3(0.05, 0.16, 0.11) * f * u_aura;          // the body, barely there
  col += vec3(1.00, 0.72, 0.34) * trail * u_bloom;     // where the swarm has been
  col += flies(v_uv, 1.0, u_halo);                             // and where it is now

  col = 1.0 - exp(-col * u_expose);                    // roll the hot cores off to white
  fragColor = vec4(col, 1.0);
}
