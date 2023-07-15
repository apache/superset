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
declare module '@math.gl/web-mercator';

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

  export class HeatmapLayer<T extends object = any> extends Layer<
    T,
    HeatmapLayerProps<T>
  > {
    constructor(props: HeatmapLayerProps<T>);
  }
}

declare module '*.png' {
  const value: any;
  export default value;
}
