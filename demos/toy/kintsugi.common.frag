// Kintsugi — shared by Buffer A and the Image pass.
//
// The floor is a slab of dark glazed ceramic with a fracture network already in
// it: three voronoi lattices at different scales — the plates, the cracks between
// them, and hairline crazing. Both passes need the same network: Buffer A to know
// where gold can run, the Image pass to draw the veins.

#define FLOOR 7.0                               // world units up the short side of the floor

const vec3 CELLS = vec3(0.55, 1.3, 4.2);        // cells per world unit, coarse to fine
const vec3 WIDTH = vec3(0.028, 0.012, 0.0055);  // vein half-width, world units
const vec3 LOSS  = vec3(0.005, 0.030, 0.35);    // gold lost per texel of travel: hairlines barely carry it

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec2 hash22(vec2 p){
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
float hash12(vec2 p){
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}

// screen uv to floor coordinates; the same in both passes because the sim buffer
// keeps the canvas aspect
vec2 world(vec2 uv, vec2 R){ return (uv - 0.5) * vec2(R.x / R.y, 1.0) * FLOOR; }

// voronoi with the true distance to the cell border (iq's two-pass method), that
// border's normal — pointing from this cell's centre toward the border — and a
// random id for the border that is the same seen from either of its cells
vec4 voroEdge(vec2 x){
  vec2 n = floor(x), f = fract(x);
  vec2 mg = vec2(0.0), mr = vec2(0.0);
  float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 g = vec2(i, j), r = g + hash22(n + g) - f;
    float d = dot(r, r);
    if (d < md){ md = d; mr = r; mg = g; }
  }
  md = 8.0;
  vec2 mn = vec2(0.0, 1.0), mc = mg;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++){
    vec2 g = mg + vec2(i, j), r = g + hash22(n + g) - f;
    if (dot(mr - r, mr - r) > 1e-5){
      vec2 dir = normalize(r - mr);
      float d = dot(0.5 * (mr + r), dir);
      if (d < md){ md = d; mn = dir; mc = g; }
    }
  }
  vec2 a = n + mg, b = n + mc;
  bool ab = a.x < b.x || (a.x == b.x && a.y < b.y);
  vec2 lo = ab ? a : b, hi = ab ? b : a;
  return vec4(md, mn, hash12(lo * 1.37 + hi * 2.71 + 0.5));
}

// the veins run thick and thin: the width at this point of the floor
float veinWidth(vec2 p, int i){ return WIDTH[i] * u_width * (0.65 + 0.7 * vnoise(p * 2.7 + float(i) * 5.0)); }

// the fracture at scale i: (distance to the nearest vein centre, its normal, its
// id), distance and normal in world units. Each lattice is rotated so the three
// never line up.
vec4 crack(vec2 p, int i){
  float c = CELLS[i];
  mat2 m = rot(float(i) * 1.9 + 0.4);
  vec4 e = voroEdge(m * p * c + float(i) * vec2(7.3, 2.1));
  return vec4(e.x / c, e.yz * m, e.w);          // v * m == transpose(m) * v: normal back to world
}
