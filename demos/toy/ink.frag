// Image pass. iChannel0 = Buffer A, iChannel1 = the mask.

void mainImage(out vec4 O, in vec2 F){
  vec2 R = iResolution.xy, uv = F / R;

  vec3 c = texture(iChannel0, uv).rgb;
  vec2 e = 3.0 / R;                                     // cheap bloom off the buffer
  c += 0.09 * (texture(iChannel0, uv + vec2(e.x, 0.0)).rgb + texture(iChannel0, uv - vec2(e.x, 0.0)).rgb
             + texture(iChannel0, uv + vec2(0.0, e.y)).rgb + texture(iChannel0, uv - vec2(0.0, e.y)).rgb);

  c += 0.05 * maskTex(uv);                              // faint fill so the body reads
  O = vec4(1.0 - exp(-c * u_gain * 1.4), 1.0);          // tone map
}
