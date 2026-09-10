// Flowering meadow — shading pass: grass, then one flower per grid cell, opened
// by the bloom value the sim keeps for that spot.

vec2 aspect(){ return vec2(u_res.x / u_res.y, 1.0); }

void main(){
  vec4 s = texture(u_state, v_uv);

  if (u_view > 0.5) {                                   // 1 bloom, 2 touch, 3 mask
    if (u_view < 1.5) { fragColor = vec4(vec3(s.r), 1.0); return; }
    if (u_view < 2.5) { fragColor = vec4(vec3(s.g), 1.0); return; }
    fragColor = vec4(vec3(mask()), 1.0); return;
  }

  vec2 asp = aspect();
  vec2 gp = v_uv * asp;
  float gust = (fbm(vec2(u_time * 0.35, 4.2)) - 0.5) * 2.0;

  // grass: mottled greens plus fine blades, leaning with the gust
  vec3 col = mix(vec3(0.055, 0.110, 0.045), vec3(0.165, 0.300, 0.100), fbm(gp * 5.0));
  float blade = 0.6 * vnoise(vec2(gp.x * 150.0 + gust * u_wind * 6.0, gp.y * 22.0))
              + 0.4 * vnoise(vec2(gp.x * 52.0, gp.y * 9.0));
  col *= 0.80 + 0.42 * blade * u_grass;
  col += vec3(0.06, 0.07, 0.02) * pow(fbm(gp * 14.0), 3.0) * u_grass;   // dry stems catching light
  col *= (0.88 + 0.24 * v_uv.y) * (1.0 - u_shade * mask());             // and the body's own shadow

  // flowers: one per cell, only the 3x3 neighbours can reach this pixel
  float g = max(u_density, 2.0);
  vec2 cp = gp * g;
  vec2 ci = floor(cp);
  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      vec2 cell = ci + vec2(float(x), float(y));
      float h1 = hash21(cell), h2 = hash21(cell + 3.3), h3 = hash21(cell + 11.7);
      if (h3 > u_fill) continue;                        // nothing grows in this cell

      vec2 c = cell + 0.5 + 0.32 * (vec2(h1, h2) * 2.0 - 1.0);
      vec4 st = texture(u_state, clamp(c / g / asp, 0.0, 1.0));
      float bloom = st.r, age = st.b;
      if (bloom < 0.02) continue;

      float sway = gust * u_wind * (0.5 + 0.9 * h2);
      vec2 q = cp - (c + vec2(sway * 0.16, sway * 0.05));
      float rr = length(q);
      float open = smoothstep(0.0, 1.0, bloom);
      float size = u_size * (0.5 + 0.5 * h1) * open;
      if (rr > size * 1.6) continue;                    // cheap reject: nowhere near this flower

      float np = 5.0 + floor(h2 * 4.0);                 // 5..8 petals
      float ang = atan(q.y, q.x) + h1 * 6.2831 + sway * 0.4;
      // pow < 1 fattens the lobes: a rose curve on its own gives pointed stars
      float shape = mix(0.40, 1.0, pow(0.5 + 0.5 * cos(ang * np), 0.55));
      float d = rr / max(size * shape, 1e-4);
      float petal = 1.0 - smoothstep(1.0 - u_soft, 1.0, d);

      // a shadow just down and right of the flower — cheap, but it lifts the
      // petals off the grass instead of leaving them stuck on like stickers
      float ds = length(q - vec2(0.13, -0.13) * size) / max(size * shape, 1e-4);
      col *= 1.0 - 0.35 * (1.0 - smoothstep(0.75, 1.1, ds));

      if (petal <= 0.0) continue;               // shadow only: this pixel is beside the flower

      // white / pink / yellow / violet, pale while the flower is still young
      float t = fract(h1 * 3.7 + u_hue);
      vec3 pc = t < 0.25 ? vec3(1.00, 0.96, 0.93)
              : t < 0.50 ? vec3(1.00, 0.45, 0.62)
              : t < 0.75 ? vec3(1.00, 0.82, 0.25)
                         : vec3(0.72, 0.55, 1.00);
      pc = mix(mix(pc, vec3(1.0), 0.45), pc, age);
      pc = mix(vec3(0.35, 0.60, 0.22), pc, smoothstep(0.08, 0.45, bloom));   // green bud first

      pc *= mix(0.68, 1.12, clamp(d, 0.0, 1.0));        // dark throat, bright tips
      pc *= 0.93 + 0.07 * cos(ang * np * 3.0);          // veins

      col = mix(col, pc, petal);

      float disc = 1.0 - smoothstep(0.16, 0.26, rr / max(size, 1e-4));
      vec3 stamen = vec3(1.0, 0.80, 0.22) * (0.7 + 0.5 * hash21(floor(q * 260.0)));
      col = mix(col, stamen, disc * open);
    }
  }

  fragColor = vec4(col, 1.0);
}
