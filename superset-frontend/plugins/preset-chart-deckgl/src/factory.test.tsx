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
import { ThemeProvider, supersetTheme } from '@apache-superset/core/theme';
import { JsonObject } from '@superset-ui/core';
import { createDeckGLComponent } from './factory';
import { Point } from './types';

const mockViewports: JsonObject[] = [];
jest.mock('./DeckGLContainer', () => ({
  DeckGLContainerStyledWrapper: jest
    .requireActual('react')
    .forwardRef(({ viewport }: { viewport: JsonObject }) => {
      mockViewports.push(viewport);
      return <div data-test="deckgl-container" />;
    }),
}));

const DeckGLComponent = createDeckGLComponent(
  () => ({}),
  (features: JsonObject[]) => features.map(feature => feature.position),
);

const payloadAt = (positions: Point[]) => ({
  data: { features: positions.map(position => ({ position })) },
});

test.each([
  [true, 51.5],
  [false, 0],
])(
  'with autozoom %s a refreshed response leaves the map centered at latitude %s',
  (autozoom, expectedLatitude) => {
    const props = {
      formData: { datasource: '1__table', viz_type: 'deck_grid', autozoom },
      viewport: { longitude: 0, latitude: 0, zoom: 1 },
      width: 400,
      height: 300,
      setControlValue: jest.fn(),
      payload: payloadAt([
        [-122.45, 37.75],
        [-122.4, 37.8],
      ]),
    } as unknown as Parameters<typeof DeckGLComponent>[0];

    const { rerender } = render(
      <ThemeProvider theme={supersetTheme}>
        <DeckGLComponent {...props} />
      </ThemeProvider>,
    );
    expect(mockViewports.at(-1)?.latitude).toBeCloseTo(autozoom ? 37.775 : 0);

    rerender(
      <ThemeProvider theme={supersetTheme}>
        <DeckGLComponent
          {...props}
          payload={payloadAt([
            [-0.15, 51.48],
            [-0.1, 51.52],
          ])}
        />
      </ThemeProvider>,
    );
    expect(mockViewports.at(-1)?.latitude).toBeCloseTo(expectedLatitude, 1);
  },
);

test('with autozoom a tilt written back by Explore keeps the viewer on the same rows', () => {
  const positions: Point[] = [
    [-122.45, 37.75],
    [-122.4, 37.8],
  ];
  const props = {
    formData: { datasource: '1__table', viz_type: 'deck_grid', autozoom: true },
    viewport: { longitude: 0, latitude: 0, zoom: 1 },
    width: 400,
    height: 300,
    setControlValue: jest.fn(),
    payload: payloadAt(positions),
  } as unknown as Parameters<typeof DeckGLComponent>[0];

  const { rerender } = render(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLComponent {...props} />
    </ThemeProvider>,
  );
  const fitted = mockViewports.at(-1);

  // Explore saves the viewer's tilt through setControlValue, and the transform
  // re-runs on the same response, building a new features array.
  rerender(
    <ThemeProvider theme={supersetTheme}>
      <DeckGLComponent
        {...props}
        viewport={{ longitude: -100, latitude: 20, zoom: 6, pitch: 40 }}
        payload={payloadAt(positions)}
      />
    </ThemeProvider>,
  );
  expect(mockViewports.at(-1)).toEqual(fitted);
});
