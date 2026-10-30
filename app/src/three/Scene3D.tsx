import { useEffect, useRef } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
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
    // expo-gl não implementa todos os parâmetros de pixelStorei; ignora os não suportados.
    const pixelStorei = gl.pixelStorei.bind(gl);
    gl.pixelStorei = (pname: number, param: number | boolean) => {
      if (pname === gl.UNPACK_FLIP_Y_WEBGL || pname === gl.UNPACK_ALIGNMENT) pixelStorei(pname, param as number);
    };
  }
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

/** Área de desenho 3D. Para trocar de cena, mude a `key` do componente. */
export function Scene3D({ factory, style }: { factory: SceneFactory; style?: StyleProp<ViewStyle> }) {
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

  const onContextCreate = (gl: ExpoWebGLRenderingContext) => {
    const r = createRenderer(gl);
    renderer.current = r;
    const h = factoryRef.current(r, gl.drawingBufferWidth, gl.drawingBufferHeight);
    handle.current = h;
    const start = performance.now();
    let last = start;
    const loop = () => {
      frame.current = requestAnimationFrame(loop);
      const now = performance.now();
      h.update((now - start) / 1000, Math.min(0.05, (now - last) / 1000));
      last = now;
      gl.endFrameEXP();
    };
    frame.current = requestAnimationFrame(loop);
  };

  return <GLView style={style} onContextCreate={onContextCreate} msaaSamples={4} />;
}
