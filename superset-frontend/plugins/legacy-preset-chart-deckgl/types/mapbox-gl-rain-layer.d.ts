declare module 'mapbox-gl-rain-layer' {
    import { Layer } from 'mapbox-gl';
  
    interface RainLayerOptions {
      id?: string;
      source?: string;
      scale?: string;
      [key: string]: any;
    }
  
    class RainLayer implements Layer {
      constructor(options: RainLayerOptions);
      id: string;
      type: 'custom';
      render: () => void;
      onAdd: (map: mapboxgl.Map, gl: WebGLRenderingContext) => void;
      onRemove: () => void;
      getLegendHTML: () => string;
      on: (event: string, callback: (data: any) => void) => void;
    }
  
    export default RainLayer;
  }
  