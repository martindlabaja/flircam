// Shared by both passes: where every firefly is right now, and how bright.
//
// One fly per cell of a coarse grid. A pixel can only be lit by the 3x3 cells
// around it, so the swarm gets as dense as the grid without costing any more —
// this is the cheap way to have hundreds of particles in a fullscreen pass.

vec2 aspect(){ return vec2(u_res.x / u_res.y, 1.0); }

// The field sim.frag maintains: .g = how much body has been here lately,
// .ba = unit vector pointing up that field, i.e. towards the body.
vec4 presence(vec2 uv){ return texture(u_state, clamp(uv, 0.0, 1.0)); }

// `core` tightens the falloff: 1.0 draws the fly itself, lower values draw the
// soft blob that the trail buffer smears into a streak. `halo` adds the wide
// bloom around it — the trail pass leaves that off, or the streaks smear into fog.
vec3 flies(vec2 uv, float core, float halo){
  vec2 asp = aspect();
  float g = max(u_density, 2.0);
  vec2 gp = uv * asp * g;                       // position in cells
  vec2 ci = floor(gp);
  vec3 sum = vec3(0.0);

  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      vec2 cell = ci + vec2(float(x), float(y));
      float h1 = hash21(cell), h2 = hash21(cell + 7.7), h3 = hash21(cell + 19.1);
      if (h3 > u_fill) continue;                // no fly lives in this cell

      // Lazy drift inside the cell, each fly on its own clock, plus a fast
      // wobble that fades in near the body — that agitation is what draws the
      // streaks. Excitement scales amplitudes, never frequencies: a rate that
      // depends on the mask would jump the phase and make the swarm flicker.
      float sp = 0.35 + 1.0 * h1;
      float f = presence((cell + 0.5) / g / asp).g;
      vec2 home = cell + 0.5
        + 0.40 * (1.0 + 0.5 * f) * vec2(sin(u_time * sp + h1 * 40.0),
                                        sin(u_time * sp * 0.83 + h2 * 37.0))
        + 0.10 * f * vec2(sin(u_time * 5.7 + h1 * 20.0), cos(u_time * 4.9 + h2 * 17.0));

      // steer by the field: drawn in towards the body, and swung around it
      vec4 pr = presence(home / g / asp);
      f = max(f, pr.g);
      vec2 dir = pr.ba;
      vec2 orbit = vec2(-dir.y, dir.x) * u_swirl * sin(u_time * 0.7 + h1 * 12.0);
      vec2 pos = home + clamp((dir * u_attract + orbit) * f, -0.9, 0.9);

      // a real firefly is dark most of the time and then flares: the high power
      // keeps the field sparse and makes the pulses read. Near the body it
      // switches over to a faster pulse — crossfaded, again to keep the phase.
      float base = h2 * 43.0 + u_time * u_blink;
      float blink = mix(pow(0.5 + 0.5 * sin(base * (0.6 + 0.8 * h1)), 5.0),
                        pow(0.5 + 0.5 * sin(base * (2.0 + 1.2 * h1)), 3.0), clamp(f, 0.0, 1.0));
      float lum = (0.03 + 0.97 * blink) * (1.0 + u_excite * f);

      float r = 0.065 + 0.05 * h1;
      float d = length(gp - pos) / r;
      float d2 = d * d * core;
      vec3 tint = mix(vec3(1.0, 0.72, 0.26), vec3(0.62, 1.0, 0.55), h1);   // amber to green
      sum += tint * lum * (exp(-d2) + halo * exp(-d2 * 0.09));             // body + halo
    }
  }
  return sum;
}
