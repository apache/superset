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
import { useCallback, useEffect, useRef } from 'react';
import { useMap as useMapLibre } from 'react-map-gl/maplibre';
import { useMap as useMapbox } from 'react-map-gl/mapbox';

export interface RedrawParams {
  width: number;
  height: number;
  ctx: CanvasRenderingContext2D;
  isDragging: boolean;
  project: (lngLat: [number, number]) => [number, number];
}

interface CanvasOverlayProps {
  redraw: (params: RedrawParams) => void;
}

export default function CanvasOverlay({ redraw }: CanvasOverlayProps) {
  const mapLibreContext = useMapLibre();
  const mapboxContext = useMapbox();
  const mapRef = (mapLibreContext.current ?? mapboxContext.current) as any;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);

  const project = useCallback(
    (lngLat: [number, number]): [number, number] => {
      if (!mapRef) return [0, 0];
      const map = mapRef.getMap();
      const point = map.project(lngLat);
      return [point.x, point.y];
    },
    [mapRef],
  );

  const performRedraw = useCallback(() => {
    const canvas = canvasRef.current;
    const map = mapRef?.getMap();
    if (!canvas || !map) return;

    const container = map.getContainer();
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    redraw({
      width,
      height,
      ctx,
      isDragging: isDraggingRef.current,
      project,
    });
  }, [mapRef, redraw, project]);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return undefined;

    const onMove = () => performRedraw();
    const onDragStart = () => {
      isDraggingRef.current = true;
    };
    const onDragEnd = () => {
      isDraggingRef.current = false;
      performRedraw();
    };
    const onResize = () => performRedraw();

    map.on('move', onMove);
    map.on('dragstart', onDragStart);
    map.on('dragend', onDragEnd);
    map.on('resize', onResize);

    performRedraw();

    return () => {
      map.off('move', onMove);
      map.off('dragstart', onDragStart);
      map.off('dragend', onDragEnd);
      map.off('resize', onResize);
    };
  }, [mapRef, performRedraw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
