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
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Layer } from '@deck.gl/core';
import type { MapboxOverlay } from '@deck.gl/mapbox';
import DeckGLOverlayMapLibre from './DeckGLOverlayMapLibre';

const setProps = jest.fn();
const mockOverlay = { setProps } as unknown as MapboxOverlay;
const MockMapboxOverlay = jest.fn((..._args: unknown[]) => mockOverlay);

jest.mock('react-map-gl/maplibre', () => {
  const { useState } = jest.requireActual('react');
  // Mirrors real useControl's lazy-initialize-once behavior (useState's
  // initializer only runs on mount), so re-renders don't reconstruct the
  // overlay - only the component's own setProps call should run per render.
  return {
    useControl: (factory: () => unknown) => useState(factory)[0],
  };
});

jest.mock('@deck.gl/mapbox', () => ({
  // A `function`, not an arrow (the real component calls this with `new`,
  // and arrow functions can't be constructors), that only reaches
  // MockMapboxOverlay when actually invoked - referencing it directly here
  // would hit it before its `const` initializer runs, since jest hoists
  // this mock factory above the rest of the file.
  MapboxOverlay: function MapboxOverlay(...args: unknown[]) {
    return MockMapboxOverlay(...args);
  },
}));

afterEach(() => {
  jest.clearAllMocks();
});

test('constructs a single MapboxOverlay with the initial layers', () => {
  const layers = [{ id: 'layer-1' } as unknown as Layer];
  render(<DeckGLOverlayMapLibre layers={layers} />);

  expect(MockMapboxOverlay).toHaveBeenCalledTimes(1);
  expect(MockMapboxOverlay).toHaveBeenCalledWith({ layers });
});

test('threads updated props into the overlay via setProps on every render', () => {
  const initialLayers = [{ id: 'layer-1' } as unknown as Layer];
  const { rerender } = render(<DeckGLOverlayMapLibre layers={initialLayers} />);

  expect(setProps).toHaveBeenLastCalledWith({ layers: initialLayers });

  const updatedLayers = [{ id: 'layer-2' } as unknown as Layer];
  rerender(<DeckGLOverlayMapLibre layers={updatedLayers} />);

  // The overlay itself is only constructed once; later prop changes go
  // through setProps rather than a new MapboxOverlay instance.
  expect(MockMapboxOverlay).toHaveBeenCalledTimes(1);
  expect(setProps).toHaveBeenLastCalledWith({ layers: updatedLayers });
});

test('renders nothing to the DOM', () => {
  const { container } = render(<DeckGLOverlayMapLibre layers={[]} />);
  expect(container).toBeEmptyDOMElement();
});
