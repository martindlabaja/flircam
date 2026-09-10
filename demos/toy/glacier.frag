// Glacier — a fractal ice terrain the silhouette builds.
// iChannel0 = Buffer A (r = ice thickness, g = fresh snow), iChannel1 = the mask.
//
// A raymarched heightfield: ridged fBm supplies the fractal rock, Buffer A says
// where the ice piles on top of it. Seen from the air the body reads as a
// massif, and the terrain keeps the shape until the ice melts.

#define MAP 4.0     // world units across the ice map

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float hash12(vec2 p){
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p + 19.19);
  return fract((p.x + p.y) * p.x);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1,0)), f.x),
             mix(hash12(i + vec2(0,1)), hash12(i + vec2(1,1)), f.x), f.y);
}
// ridged fBm: 1-|2n-1|, squared. The creases are what make it read as rock and
// ice instead of rolling hills. Each octave is rotated so the grid never shows.
float ridged(vec2 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < oct; i++){
    float v = 1.0 - abs(noise(p) * 2.0 - 1.0);
    s += a * v * v;
    n += a;
    p = rot(0.63) * p * 2.03 + 4.7;
    a *= 0.5;
  }
  return s / n;
}

// The camera's aspect, recovered from the cover-fit the harness hands us — the
// ice map is a ground rectangle of that shape, so the frame lands uncropped.
float srcAR(){ return (u_res.x / u_res.y) * u_maskFit.y / u_maskFit.x; }
vec2 mapSize(){ return vec2(MAP, MAP / srcAR()); }

// plan view: world +z is toward the camera, so flip v — the head lies away from
// us and the body reads the right way up
vec2 mapUV(vec2 p){
  vec2 uv = p / mapSize() + 0.5;
  return clamp(vec2(uv.x, 1.0 - uv.y), 0.003, 0.997);
}

float maskRaw(vec2 uv){
  if (u_mirror > 0.5) uv.x = 1.0 - uv.x;
  float v = texture(iChannel1, uv).r;
  return u_invert > 0.5 ? 1.0 - v : v;
}
float iceAt(vec2 p){ return texture(iChannel0, mapUV(p)).r; }
float freshAt(vec2 p){ return texture(iChannel0, mapUV(p)).g; }

float height(vec2 p, int oct){
  float r = ridged(p * 1.1, oct);
  return u_relief * (0.06 + 0.44 * r) + u_lift * iceAt(p) * (0.35 + 0.75 * r);
}
// the tallest the terrain can get, so the march can skip the sky above it
float ceiling(){ return u_relief * 0.50 + u_lift * 1.10 + 0.02; }

float march(vec3 ro, vec3 rd, float tmax){
  float t = 0.0, top = ceiling();
  if (ro.y > top){
    if (rd.y > -1e-3) return -1.0;          // looking up: never comes back down
    t = (ro.y - top) / (-rd.y);             // skip the empty sky above the range
  }
  for (int i = 0; i < 110; i++){
    vec3 p = ro + rd * t;
    float d = p.y - height(p.xz, 5);
    if (d < 0.0015 * t) return t;
    t += max(0.40 * d, 0.004 * t);          // a heightfield is not an SDF: step short
    if (t > tmax) break;
  }
  return -1.0;
}

vec3 normalAt(vec3 p, float t){
  vec2 e = vec2(0.0016 * (1.0 + t), 0.0);
  return normalize(vec3(height(p.xz - e.xy, 8) - height(p.xz + e.xy, 8),
                        2.0 * e.x,
                        height(p.xz - e.yx, 8) - height(p.xz + e.yx, 8)));
}

float shadow(vec3 p, vec3 l){
  float res = 1.0, t = 0.02, top = ceiling();
  for (int i = 0; i < 22; i++){
    vec3 q = p + l * t;
    if (q.y > top) break;
    float d = q.y - height(q.xz, 5);
    res = min(res, 14.0 * d / t);
    if (res < 0.02) break;
    t += clamp(d, 0.02, 0.30);
  }
  return clamp(res, 0.0, 1.0);
}

vec3 skyCol(vec3 rd, vec3 sun){
  vec3 c = mix(vec3(0.70, 0.79, 0.92), vec3(0.09, 0.23, 0.52), pow(clamp(rd.y, 0.0, 1.0), 0.55));
  float s = clamp(dot(rd, sun), 0.0, 1.0);
  c += vec3(1.00, 0.86, 0.66) * (0.22 * pow(s, 8.0) + 1.4 * pow(s, 900.0));
  if (rd.y > 0.06){                                  // a thin sheet of high cloud
    vec2 cp = rd.xz / rd.y * 1.2 + vec2(iTime * 0.012, 0.0);
    float cl = smoothstep(0.40, 0.90, ridged(cp, 5));
    c = mix(c, vec3(0.93, 0.95, 0.98), cl * 0.55 * smoothstep(0.06, 0.35, rd.y));
  }
  return c;
}

void mainImage(out vec4 O, in vec2 F){
  vec2 R = iResolution.xy;

  if (u_view > 0.5){                                 // 1 the ice map, 2 the raw mask
    float v = u_view < 1.5 ? texture(iChannel0, F / R).r : maskRaw(F / R);
    O = vec4(vec3(v), 1.0);
    return;
  }

  vec2 q = (2.0 * F - R) / R.y;
  vec3 sun = normalize(vec3(0.72, 0.36, 0.42));   // side-on and slightly behind us: ridges catch it

  float az = 0.5 * u_orbit * sin(iTime * 0.06);
  float pitch = mix(0.18, 1.15, u_tilt);
  vec3 ta = vec3(0.0, 0.15, 0.0);
  vec3 ro = ta + 4.6 * vec3(sin(az) * cos(pitch), sin(pitch), cos(az) * cos(pitch));
  vec3 ww = normalize(ta - ro), uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0))), vv = cross(uu, ww);
  vec3 rd = normalize(q.x * uu + q.y * vv + 1.5 * ww);

  vec3 col;
  float t = march(ro, rd, 18.0);
  if (t < 0.0){
    col = skyCol(rd, sun);
  } else {
    vec3 pos = ro + rd * t;
    vec3 n = normalAt(pos, t);
    float ice = iceAt(pos.xz);
    float fresh = freshAt(pos.xz);
    float steep = 1.0 - n.y;

    // rock shows through where it is too steep to hold snow and the ice is thin
    float rocky = smoothstep(0.28, 0.60, steep) * (1.0 - smoothstep(0.12, 0.45, ice));
    // crevasses: thin cracks across thick ice on a tilt. Narrow on purpose —
    // widen the band and the whole face turns into blue squiggles
    float crev = smoothstep(0.80, 0.97, 1.0 - abs(noise(pos.xz * 26.0) * 2.0 - 1.0))
               * smoothstep(0.10, 0.40, ice)
               * smoothstep(0.04, 0.20, steep) * (1.0 - smoothstep(0.55, 0.85, steep));

    vec3 snow = mix(vec3(0.78, 0.84, 0.92), vec3(0.96, 0.98, 1.00), fresh);
    vec3 rock = mix(vec3(0.19, 0.18, 0.19), vec3(0.35, 0.32, 0.28), noise(pos.xz * 9.0));
    vec3 alb = mix(snow, rock, rocky);
    // a serac wall is blue glass, not snow
    alb = mix(alb, vec3(0.38, 0.62, 0.84), smoothstep(0.50, 0.88, steep) * smoothstep(0.20, 0.60, ice) * 0.45);
    alb = mix(alb, vec3(0.20, 0.47, 0.76), crev * 0.6);

    float dif = clamp(dot(n, sun), 0.0, 1.0);
    float sha = shadow(pos + n * 0.004, sun);
    float amb = 0.5 + 0.5 * n.y;
    float bnc = clamp(0.3 - 0.7 * n.y, 0.0, 1.0);
    // ice is translucent, so it glows blue in its own shade rather than going flat
    float sss = pow(1.0 - dif, 2.0) * smoothstep(0.05, 0.5, ice);

    // snow is nearly white, so the shape has to come from the light: a strong
    // low sun against a modest ambient, not a bright ambient that flattens it
    vec3 lin = vec3(1.52, 1.28, 0.98) * dif * sha
             + vec3(0.13, 0.20, 0.36) * amb
             + vec3(0.10, 0.11, 0.10) * bnc
             + vec3(0.14, 0.30, 0.50) * sss * 0.5;
    col = alb * lin;

    vec3 hv = normalize(sun - rd);                   // wet-ice highlight
    col += vec3(1.00, 0.96, 0.88) * pow(clamp(dot(n, hv), 0.0, 1.0), 48.0)
         * sha * (0.25 + 0.75 * (1.0 - rocky));

    col = mix(col, skyCol(rd, sun) * 0.85, 1.0 - exp(-0.0011 * u_fog * t * t * t));
  }

  col = 1.0 - exp(-col * u_gain);
  col = pow(max(col, 0.0), vec3(0.4545));            // real lighting, so gamma out
  O = vec4(col, 1.0);
}
