import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import * as THREE from 'three';

export interface SceneHandle {
  /** Chamado a cada quadro: `t` = segundos desde o início, `dt` = segundos desde o quadro anterior. */
  update(t: number, dt: number): void;
  dispose(): void;
}

export type SceneFactory = (renderer: THREE.WebGLRenderer, width: number, height: number) => SceneHandle;

/** Cria um WebGLRenderer do three.js sobre o contexto do expo-gl (iOS, Android e web). */
function createRenderer(gl: ExpoWebGLRenderingContext) {
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  let canvas: HTMLCanvasElement;
  if (Platform.OS === 'web') {
    canvas = (gl as unknown as { canvas: HTMLCanvasElement }).canvas;
  } else {
    // No celular não existe <canvas>: o three.js só precisa de um objeto com estas propriedades.
    canvas = {
      width: w,
      height: h,
      style: {},
      clientWidth: w,
      clientHeight: h,
      addEventListener: () => {},
      removeEventListener: () => {},
      getContext: () => gl,
    } as unknown as HTMLCanvasElement;
    // Em alguns aparelhos o expo-gl não responde getShaderPrecisionFormat; o three.js precisa do valor.
    const precisionFormat = gl.getShaderPrecisionFormat?.bind(gl);
    gl.getShaderPrecisionFormat = ((shaderType: number, precisionType: number) =>
      precisionFormat?.(shaderType, precisionType) ?? {
        rangeMin: 127,
        rangeMax: 127,
        precision: 23,
      }) as typeof gl.getShaderPrecisionFormat;
    // expo-gl não implementa todos os parâmetros de pixelStorei; ignora os não suportados.
    const pixelStorei = gl.pixelStorei.bind(gl);
    gl.pixelStorei = (pname: number, param: number | boolean) => {
      if (pname === gl.UNPACK_FLIP_Y_WEBGL || pname === gl.UNPACK_ALIGNMENT) pixelStorei(pname, param as number);
    };
  }
  // No expo-gl a classe do contexto WebGL2 herda de WebGLRenderingContext; o three.js (r163+)
  // testa `instanceof WebGLRenderingContext` e recusaria o contexto achando que é WebGL 1.
  const g = globalThis as { WebGLRenderingContext?: unknown };
  const webgl1 = g.WebGLRenderingContext;
  if (Platform.OS !== 'web') g.WebGLRenderingContext = undefined;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true });
  } finally {
    if (Platform.OS !== 'web') g.WebGLRenderingContext = webgl1;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

/**
 * Área de desenho 3D. Para trocar de cena, mude a `key` do componente.
 * Se o aparelho não conseguir desenhar em 3D, mostra `fallback` em vez de derrubar o app.
 */
export function Scene3D({
  factory,
  style,
  fallback,
}: {
  factory: SceneFactory;
  style?: StyleProp<ViewStyle>;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const frame = useRef<number | null>(null);
  const handle = useRef<SceneHandle | null>(null);
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const factoryRef = useRef(factory);
  factoryRef.current = factory;

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      handle.current?.dispose();
      renderer.current?.dispose();
    },
    [],
  );

  const fail = (e: unknown) => {
    console.warn('[3D] desativado neste aparelho:', e);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    setFailed(true);
  };

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    let h: SceneHandle;
    try {
      const r = createRenderer(gl);
      renderer.current = r;
      h = factoryRef.current(r, gl.drawingBufferWidth, gl.drawingBufferHeight);
      handle.current = h;
    } catch (e) {
      fail(e);
      return;
    }
    const start = performance.now();
    let last = start;
    const loop = () => {
      frame.current = requestAnimationFrame(loop);
      const now = performance.now();
      try {
        h.update((now - start) / 1000, Math.min(0.05, (now - last) / 1000));
        gl.endFrameEXP();
      } catch (e) {
        fail(e);
      }
      last = now;
    };
    frame.current = requestAnimationFrame(loop);
  };

  if (failed) {
    return <View style={[style, { alignItems: 'center', justifyContent: 'flex-end' }]}>{fallback}</View>;
  }
  return <GLView style={style} onContextCreate={onContextCreate} msaaSamples={4} />;
}
