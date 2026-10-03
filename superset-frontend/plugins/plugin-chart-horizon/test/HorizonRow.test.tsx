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
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import HorizonRow from '../src/HorizonRow';

const mockContext = {
  imageSmoothingEnabled: false,
  fillStyle: '',
  clearRect: jest.fn(),
  setTransform: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  fillRect: jest.fn(),
};

beforeAll(() => {
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D);
});

beforeEach(() => {
  jest.clearAllMocks();
});

const positiveData = [{ y: 1 }, { y: 2 }, { y: 3 }];

test('renders the title and a canvas of the given size', () => {
  const { container } = render(
    <HorizonRow data={positiveData} title="series-a" width={100} height={20} />,
  );

  expect(screen.getByText('series-a')).toBeInTheDocument();
  const canvas = container.querySelector('canvas');
  expect(canvas).toHaveAttribute('width', '100');
  expect(canvas).toHaveAttribute('height', '20');
});

test('draws positive bands to the canvas on mount', () => {
  render(<HorizonRow data={positiveData} width={100} height={20} />);

  expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 100, 20);
  expect(mockContext.fillRect).toHaveBeenCalled();
  // No negative values, so the canvas is never flipped
  expect(mockContext.scale).not.toHaveBeenCalled();
});

test('flips the canvas to mirror negative bands in offset mode', () => {
  render(
    <HorizonRow
      data={[{ y: -1 }, { y: 2 }]}
      mode="offset"
      width={100}
      height={20}
    />,
  );

  expect(mockContext.translate).toHaveBeenCalledWith(0, 20);
  expect(mockContext.scale).toHaveBeenCalledWith(1, -1);
  expect(mockContext.fillRect).toHaveBeenCalled();
});

test('redraws when the data prop changes', () => {
  const { rerender } = render(
    <HorizonRow data={positiveData} width={100} height={20} />,
  );
  const drawsAfterMount = mockContext.clearRect.mock.calls.length;

  rerender(<HorizonRow data={[{ y: 5 }, { y: 6 }]} width={100} height={20} />);

  expect(mockContext.clearRect.mock.calls.length).toBeGreaterThan(
    drawsAfterMount,
  );
});

test('memo bailout skips redraw when props are unchanged', () => {
  const { rerender } = render(
    <HorizonRow data={positiveData} width={100} height={20} />,
  );
  const drawsAfterMount = mockContext.clearRect.mock.calls.length;

  rerender(<HorizonRow data={positiveData} width={100} height={20} />);

  expect(mockContext.clearRect.mock.calls.length).toBe(drawsAfterMount);
});
