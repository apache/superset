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

import handleCanvasChange, { repaintCanvas, Canvas } from './canvasRepaint';
import * as canvasRepaint from './canvasRepaint';

const canvases: Canvas[] = [
  {
    width: 100,
    height: 100,
    getContext: jest.fn().mockReturnValue({
      clearRect: jest.fn(),
      drawImage: jest.fn(),
    }),
  },
  {
    width: 200,
    height: 200,
    getContext: jest.fn().mockReturnValue({
      clearRect: jest.fn(),
      drawImage: jest.fn(),
    }),
  },
];
describe('repaintCanvas', () => {
  afterEach(() => {
    jest.clearAllMocks(); // Clears all mock functions' usage data
  });

  it('should clear the canvas and draw the copied content', () => {
    const canvas = {
      width: 100,
      height: 100,
      getContext: jest.fn().mockReturnValue({
        clearRect: jest.fn(),
        drawImage: jest.fn(),
      }),
    };
    const ctx = canvas.getContext('2d');
    const imageBitmap = {} as ImageBitmap;

    repaintCanvas(canvas, ctx, imageBitmap);

    expect(ctx.clearRect).toHaveBeenCalledWith(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    expect(ctx.drawImage).toHaveBeenCalledWith(imageBitmap, 0, 0);
  });

  it('should call createImageBitmap for each canvas with the copied content', () => {
    const imageBitmapMock = {
      width: 100, // Example width property
      height: 100, // Example height property
      close: jest.fn(), // Example close method
    };

    // Mock createImageBitmap
    global.createImageBitmap = jest
      .fn()
      .mockResolvedValue(() => Promise.resolve(imageBitmapMock));

    handleCanvasChange(canvases);

    expect(canvases[0].getContext).toHaveBeenCalledWith('2d');
    expect(canvases[1].getContext).toHaveBeenCalledWith('2d');
    expect(createImageBitmap).toHaveBeenCalledTimes(2);
  });

  it('should call repaintCanvas when canvases are provided', () => {
    const repaintCanvasMock = jest.spyOn(canvasRepaint, 'repaintCanvas');

    handleCanvasChange(canvases);

    expect(repaintCanvasMock).not.toHaveBeenCalled();
  });

  it('should not call repaintCanvas when no canvases are provided', () => {
    const canvases: Canvas[] = [];
    const repaintCanvasMock = jest.spyOn(canvasRepaint, 'repaintCanvas');

    handleCanvasChange(canvases);

    expect(repaintCanvasMock).not.toHaveBeenCalled();
  });
});
