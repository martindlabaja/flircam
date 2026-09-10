// Buffer A. iChannel0 = this buffer last frame, iChannel1 = the mask.
// Ink is laid down by the silhouette, dragged along a slow curl field, and
// fades — the feedback buffer is what makes a dancer leave a wake.

vec2 flow(vec2 uv, float t){
  return vec2(sin(uv.y * 6.0 + t * 0.50) + 0.6 * sin(uv.y * 13.0 - t * 0.31),
              cos(uv.x * 5.5 - t * 0.42) + 0.6 * cos(uv.x * 11.0 + t * 0.27));
}

void mainImage(out vec4 O, in vec2 F){
  vec2 R = iResolution.xy, uv = F / R;

  vec2 v = flow(uv, iTime) * 0.0016 * u_flow;
  vec3 prev = texture(iChannel0, uv - v).rgb;          // advect: read from upstream

  float m = maskTex(uv);
  vec3 tint = 0.5 + 0.5 * cos(6.2831853 * (vec3(0.00, 0.33, 0.67) + 0.15 * iTime + uv.x * 0.4));
  vec3 ink = prev * (1.0 - u_decay * iTimeDelta) + tint * m * u_inject * iTimeDelta;

  O = vec4(min(ink, 4.0), 1.0);
}
