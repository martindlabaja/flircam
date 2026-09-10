// Runs on shadertoy.com unchanged, apart from the mask read: there you would
// use texture(iChannel0, F / iResolution.xy).r with the webcam in channel 0.
// Here maskTex() adds the aspect fit and the panel's mirror/invert.

#define TAU 6.2831853

vec3 palette(float t){
  return 0.5 + 0.5 * cos(TAU * (vec3(0.00, 0.33, 0.67) + t));
}

void mainImage(out vec4 O, in vec2 F){
  vec2 R = iResolution.xy;
  vec2 uv = (2.0 * F - R) / R.y;
  float m = maskTex(F / R);

  // domain warp: the silhouette bends the field harder than the empty stage
  vec2 p = uv * 1.4;
  float a = 0.0, w = 0.5;
  for (int i = 0; i < 6; i++){
    p += (0.30 + 0.60 * m * u_warp) * vec2(sin(p.y * 2.7 + iTime * 0.70 + float(i)),
                                           cos(p.x * 2.4 - iTime * 0.55));
    a += w * sin(length(p) * 2.2 - iTime * 1.1 + float(i));
    w *= 0.72;
    p *= 1.12;
  }

  vec3 col = palette(0.18 * a + 0.06 * iTime + 0.35 * m);
  col *= 0.30 + 0.55 * abs(a) + 1.10 * m * u_gain;
  O = vec4(pow(col, vec3(0.85)), 1.0);
}
