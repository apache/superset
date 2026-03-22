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

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module 'supercluster' {
  interface Options<P = Record<string, unknown>, C = Record<string, unknown>> {
    minZoom?: number;
    maxZoom?: number;
    minPoints?: number;
    radius?: number;
    extent?: number;
    nodeSize?: number;
    log?: boolean;
    initial?: () => C;
    map?: (props: P) => C;
    reduce?: (accumulated: C, props: C) => void;
  }

  interface GeoJSONFeature {
    type: string;
    geometry: {
      type: string;
      coordinates: [number, number];
    };
    properties: Record<string, unknown>;
  }

  class Supercluster<P = Record<string, unknown>, C = Record<string, unknown>> {
    constructor(options?: Options<P, C>);
    load(points: GeoJSONFeature[]): Supercluster<P, C>;
    getClusters(bbox: number[], zoom: number): GeoJSONFeature[];
    getTile(z: number, x: number, y: number): GeoJSONFeature[] | null;
    getChildren(clusterId: number): GeoJSONFeature[];
    getLeaves(
      clusterId: number,
      limit?: number,
      offset?: number,
    ): GeoJSONFeature[];
    getClusterExpansionZoom(clusterId: number): number;
  }

  export default Supercluster;
  export { Options, GeoJSONFeature };
}

declare module 'react-map-gl' {
  import { Component, ReactNode } from 'react';

  interface MapGLProps {
    width?: number;
    height?: number;
    latitude?: number;
    longitude?: number;
    zoom?: number;
    mapStyle?: string;
    mapboxApiAccessToken?: string;
    onViewportChange?: Function;
    preserveDrawingBuffer?: boolean;
    children?: ReactNode;
    [key: string]: unknown;
  }

  export default class MapGL extends Component<MapGLProps> {}

  interface CanvasOverlayProps {
    redraw: (params: {
      width: number;
      height: number;
      ctx: CanvasRenderingContext2D;
      isDragging: boolean;
      project: (lngLat: [number, number]) => [number, number];
    }) => void;
  }

  export class CanvasOverlay extends Component<CanvasOverlayProps> {}
}
