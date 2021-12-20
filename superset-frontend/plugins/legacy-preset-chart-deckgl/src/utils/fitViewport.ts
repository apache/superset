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
import { fitBounds } from '@math.gl/web-mercator';
import computeBoundsFromPoints from './computeBoundsFromPoints';
import { Point } from '../types';

export type Viewport = {
  longtitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
};

export type FitViewportOptions = {
  points: Point[];
  width: number;
  height: number;
  minExtent?: number;
  maxZoom?: number;
  offset?: [number, number];
  padding?: number;
};

export default function fitViewport(
  originalViewPort: Viewport,
  {
    points,
    width,
    height,
    minExtent,
    maxZoom,
    offset,
    padding = 20,
  }: FitViewportOptions,
) {
  const { bearing, pitch } = originalViewPort;
  const bounds = computeBoundsFromPoints(points);

  try {
    return {
      ...fitBounds({
        bounds,
        width,
        height,
        minExtent,
        maxZoom,
        offset,
        padding,
      }),
      bearing,
      pitch,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Could not fit viewport', error);
  }

  return originalViewPort;
}
