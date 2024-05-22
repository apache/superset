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

export interface Canvas {
  width: number;
  height: number;
  getContext(contextId: '2d'): CanvasRenderingContext2D | null;
}

export interface CanvasRenderingContext2D {
  clearRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number): void;
}

export const repaintCanvas = (
  canvas: Canvas,
  ctx: CanvasRenderingContext2D,
  imageBitmap: ImageBitmap,
) => {
  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the copied content
  ctx.drawImage(imageBitmap, 0, 0);
};

const handleCanvasChange = (canvases: Canvas[]) => {
  canvases.forEach((canvas: Canvas) => {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      createImageBitmap(canvas as ImageBitmapSource).then(
        (imageBitmap: ImageBitmap) => {
          // Call the repaintCanvas function with canvas, ctx, and imageBitmap
          repaintCanvas(canvas, ctx, imageBitmap);
        },
      );
    }
  });
};

export default handleCanvasChange;
