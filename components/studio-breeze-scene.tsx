import * as React from "react";

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D u_texture;
  uniform float u_time;
  uniform vec2 u_uvScale;
  uniform vec2 u_uvOffset;

  varying vec2 v_uv;

  void main() {
    // Map viewport UV to natural image UV matching object-cover
    vec2 uv = v_uv * u_uvScale + u_uvOffset;
    float t = u_time;

    // 1. Hanging rail garments mask (anchored at steel bar / black hangers around y = 0.305)
    float railLeft = smoothstep(0.266, 0.292, uv.x);
    float railRight = 1.0 - smoothstep(0.635, 0.662, uv.x);
    float railTop = smoothstep(0.298, 0.326, uv.y);

    // Prevent bottom edge from overlapping the worktable on the right half (x > 0.45)
    float tableEdgeY = mix(0.668, 0.598, smoothstep(0.435, 0.485, uv.x));
    float railBottom = 1.0 - smoothstep(tableEdgeY - 0.015, tableEdgeY + 0.018, uv.y);

    float hangPivot = pow(clamp((uv.y - 0.305) / 0.34, 0.0, 1.0), 1.25);
    float shirtMask = railLeft * railRight * railTop * railBottom * hangPivot;

    // Livelier travelling window draft from left to right + crisp hem ripple
    float windWave = sin(uv.x * 19.0 - t * 3.15) * 0.65 + sin(uv.x * 8.5 - t * 1.75) * 0.35;
    float hemRipple = sin(uv.y * 26.0 - t * 4.4 + uv.x * 23.0) * 0.38;
    float gust = 0.78 + 0.28 * sin(t * 1.05 + uv.x * 3.2);

    vec2 shirtDisp = vec2(
      (windWave + hemRipple) * 0.0115 * gust * shirtMask,
      abs(windWave) * -0.0024 * gust * shirtMask
    );

    // 2. Tablecloth overhang skirt & right-hand draped raw linen
    // 2a. Front tablecloth skirt (pinned at table edge, keeping tabletop tools & wood legs stationary)
    float skirtLeft = smoothstep(0.418, 0.446, uv.x);
    float skirtRight = 1.0 - smoothstep(0.775, 0.805, uv.x);
    float lipY = mix(0.700, 0.728, smoothstep(0.44, 0.78, uv.x));
    float skirtTop = smoothstep(lipY - 0.006, lipY + 0.042, uv.y);
    float skirtBottomY = mix(0.938, 0.842, smoothstep(0.462, 0.525, uv.x));
    float skirtBottom = 1.0 - smoothstep(skirtBottomY - 0.025, skirtBottomY + 0.014, uv.y);
    float skirtMask = skirtLeft * skirtRight * skirtTop * skirtBottom;

    // 2b. Draped linen cascade on the right corner of the table (right of ceramic bowl)
    float drapeLeft = smoothstep(0.768, 0.805, uv.x);
    float drapeTop = smoothstep(0.598, 0.640, uv.y);
    float drapePivot = pow(clamp((uv.y - 0.598) / 0.35, 0.0, 1.0), 0.8);
    float drapeMask = drapeLeft * drapeTop * drapePivot;

    float clothMask = clamp(skirtMask + drapeMask, 0.0, 1.0);

    float clothWaveX = sin(uv.y * 13.5 - t * 2.55 + uv.x * 10.5) * 0.62
                     + sin(t * 1.65 + uv.x * 6.0) * 0.38;
    float clothWaveY = cos(uv.x * 14.0 - t * 2.25 + uv.y * 9.0);

    vec2 clothDisp = vec2(
      clothWaveX * 0.0105 * gust * clothMask,
      clothWaveY * 0.0042 * gust * clothMask
    );

    // 3. Potted plant foliage on bottom-left (anchored at concrete pots y ~ 0.85, swaying upward)
    float plantLeft = smoothstep(0.118, 0.145, uv.x);
    float plantRight = 1.0 - smoothstep(0.265, 0.288, uv.x);
    float plantTopY = mix(0.668, 0.538, smoothstep(0.145, 0.185, uv.x));
    float plantTop = smoothstep(plantTopY - 0.015, plantTopY + 0.025, uv.y);
    float plantBottom = 1.0 - smoothstep(0.832, 0.862, uv.y);
    float plantPivot = pow(clamp((0.860 - uv.y) / 0.31, 0.0, 1.0), 1.1);
    float plantMask = plantLeft * plantRight * plantTop * plantBottom * plantPivot;

    float leafSway = sin(t * 2.4 + uv.x * 11.0 + uv.y * 5.0) * 0.55
                   + sin(uv.y * 30.0 - t * 4.6 + uv.x * 28.0) * 0.45;
    float leafBob = cos(uv.x * 24.0 - t * 3.8 + uv.y * 18.0);

    vec2 plantDisp = vec2(
      leafSway * 0.0085 * gust * plantMask,
      leafBob * 0.0042 * gust * plantMask
    );

    vec2 finalUv = clamp(uv - shirtDisp - clothDisp - plantDisp, vec2(0.001), vec2(0.999));
    vec4 color = texture2D(u_texture, finalUv);

    // Subtle fabric & leaf light shimmer synced to the breeze
    float shirtShade = cos(uv.x * 19.0 - t * 3.15) * 0.052 * gust * shirtMask;
    float clothShade = cos(uv.y * 13.5 - t * 2.55 + uv.x * 10.5) * 0.048 * gust * clothMask;
    float leafShade = cos(uv.y * 30.0 - t * 4.6 + uv.x * 28.0) * 0.042 * gust * plantMask;
    color.rgb = clamp(color.rgb * (1.0 + shirtShade + clothShade + leafShade), 0.0, 1.0);

    gl_FragColor = color;
  }
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function StudioBreezeScene({
  src,
  alt,
  className = "",
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  onError?: () => void;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
      setReady(false);
      return;
    }

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: true,
      powerPreference: "default",
    });
    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const positionLoc = gl.getAttribLocation(program, "a_position");
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const scaleLoc = gl.getUniformLocation(program, "u_uvScale");
    const offsetLoc = gl.getUniformLocation(program, "u_uvOffset");
    const texLoc = gl.getUniformLocation(program, "u_texture");

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    let disposed = false;
    let raf = 0;
    let imgWidth = 16;
    let imgHeight = 9;
    let textureReady = false;

    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      if (disposed) return;
      imgWidth = img.naturalWidth || 16;
      imgHeight = img.naturalHeight || 9;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      textureReady = true;
      resize();
      setReady(true);
    };
    img.onerror = () => {
      if (!disposed) onError?.();
    };
    img.src = src;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    let inView = true;
    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? true;
      },
      { rootMargin: "100px" },
    );
    io.observe(container);

    const start = performance.now();
    const render = (now: number) => {
      if (disposed) return;
      if (textureReady && inView && document.visibilityState !== "hidden") {
        const cw = canvas.width || 1;
        const ch = canvas.height || 1;
        const containerAspect = cw / ch;
        const imageAspect = imgWidth / imgHeight;

        let uvScaleX = 1;
        let uvScaleY = 1;
        if (containerAspect > imageAspect) {
          uvScaleY = imageAspect / containerAspect;
        } else {
          uvScaleX = containerAspect / imageAspect;
        }
        const uvOffsetX = (1 - uvScaleX) * 0.5;
        const uvOffsetY = (1 - uvScaleY) * 0.5;

        gl.useProgram(program);
        gl.enableVertexAttribArray(positionLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(texLoc, 0);
        gl.uniform1f(timeLoc, (now - start) / 1000);
        gl.uniform2f(scaleLoc, uvScaleX, uvScaleY);
        gl.uniform2f(offsetLoc, uvOffsetX, uvOffsetY);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const onMotionChange = () => {
      if (reducedMotion.matches) setReady(false);
    };
    reducedMotion.addEventListener("change", onMotionChange);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      observer.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [src, onError]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={onError}
        className="h-full w-full object-cover select-none"
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-500 ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
