/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Type definitions for missing luma.gl modules
declare module '@luma.gl/webgl' {
  export interface WebGLDevice {
    gl: WebGL2RenderingContext | WebGLRenderingContext;
    canvasContext?: any;
    info?: any;
    features?: any;
    limits?: any;
  }

  export interface WebGLBuffer {
    handle: WebGLBuffer | null;
    byteLength: number;
    usage: number;
  }

  export interface WebGLTexture {
    handle: WebGLTexture | null;
    width: number;
    height: number;
    format: number;
    type: number;
  }

  export interface DeviceProps {
    canvas?: HTMLCanvasElement | OffscreenCanvas;
    gl?: WebGL2RenderingContext | WebGLRenderingContext;
    debug?: boolean;
    width?: number;
    height?: number;
    createCanvasContext?: boolean;
    type?: 'webgl' | 'webgl2';
  }

  export class WebGLDevice {
    constructor(props?: DeviceProps);
    createBuffer(props?: any): WebGLBuffer;
    createTexture(props?: any): WebGLTexture;
    destroy(): void;
  }

  export function createDevice(props?: DeviceProps): WebGLDevice;
}

declare module '@luma.gl/core' {
  export interface Device {
    info?: any;
    limits?: any;
    features?: any;
  }
  
  export interface Buffer {
    byteLength: number;
  }
  
  export interface Texture {
    width: number;
    height: number;
  }

  export class Device {
    constructor(props?: any);
    createBuffer(props?: any): Buffer;
    createTexture(props?: any): Texture;
  }
}

declare module '@luma.gl/engine' {
  export class Model {
    constructor(device: any, props?: any);
    draw(props?: any): void;
    destroy(): void;
  }

  export class Geometry {
    constructor(props?: any);
  }

  export class Transform {
    constructor(device: any, props?: any);
    run(props?: any): void;
    destroy(): void;
  }
}

declare module '@luma.gl/shadertools' {
  export interface ShaderModule {
    name: string;
    vs?: string;
    fs?: string;
    uniforms?: any;
    getUniforms?: (opts?: any) => any;
  }

  export function assembleShaders(gl: any, props: any): any;
}

declare module '@luma.gl/constants' {
  export const GL: {
    [key: string]: number;
  };
}

declare module 'deck.gl' {
  import { Layer, LayerProps } from '@deck.gl/core';

  interface HeatmapLayerProps<T extends object = any> extends LayerProps<T> {
    id?: string;
    data?: T[];
    getPosition?: (d: T) => number[] | null | undefined;
    getWeight?: (d: T) => number | null | undefined;
    radiusPixels?: number;
    colorRange?: number[][];
    threshold?: number;
    intensity?: number;
    aggregation?: string;
  }

  interface ContourLayerProps<T extends object = any> extends LayerProps<T> {
    id?: string;
    data?: T[];
    getPosition?: (d: T) => number[] | null | undefined;
    getWeight?: (d: T) => number | null | undefined;
    contours: {
      color?: ColorType | undefined;
      lowerThreshold?: any | undefined;
      upperThreshold?: any | undefined;
      strokeWidth?: any | undefined;
      zIndex?: any | undefined;
    };
    cellSize: number;
    colorRange?: number[][];
    intensity?: number;
    aggregation?: string;
  }

  export class HeatmapLayer<T extends object = any> extends Layer<
    T,
    HeatmapLayerProps<T>
  > {
    constructor(props: HeatmapLayerProps<T>);
  }

  export class ContourLayer<T extends object = any> extends Layer<
    T,
    ContourLayerProps<T>
  > {
    constructor(props: ContourLayerProps<T>);
  }
}

declare module '*.png' {
  const value: any;
  export default value;
}
