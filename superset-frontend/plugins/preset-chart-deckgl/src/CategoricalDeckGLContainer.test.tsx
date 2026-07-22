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
import { JsonObject, QueryFormData } from '@superset-ui/core';
import CategoricalDeckGLContainer, {
  CategoricalDeckGLContainerProps,
  getCategories,
  reconcileCategories,
} from './CategoricalDeckGLContainer';
import { addColorToFeatures } from './utils/addColor';
import { COLOR_SCHEME_TYPES } from './utilities/utils';
import { NULL_CATEGORY_KEY } from './utils';

// maplibre-gl 6 is ESM-only, so jest can't resolve it; DeckGLContainer.tsx
// calls setWorkerUrl() on it at import time.
jest.mock('maplibre-gl', () => ({ setWorkerUrl: jest.fn() }), {
  virtual: true,
});

const mockViewports: JsonObject[] = [];
jest.mock('./DeckGLContainer', () => ({
  DeckGLContainerStyledWrapper: jest
    .requireActual('react')
    .forwardRef(({ viewport }: { viewport: JsonObject }) => {
      mockViewports.push(viewport);
      return <div data-test="deckgl-container" />;
    }),
}));

// Record every (label, sliceId) pair the categorical color scale is asked to
// resolve, so we can assert the legend and point-color paths key the scale on
// the same slice id.
const scaleCalls: [string, number | undefined][] = [];
jest.mock('@superset-ui/core', () => {
  const actual = jest.requireActual('@superset-ui/core');
  return {
    ...actual,
    CategoricalColorNamespace: {
      ...actual.CategoricalColorNamespace,
      getScale: () => (value: string, sliceId?: number) => {
        scaleCalls.push([value, sliceId]);
        return value === 'A' ? '#ff0000' : '#00ff00';
      },
    },
  };
});

test('legend and point colors resolve from the same slice_id', () => {
  const fd = {
    datasource: '1__table',
    viz_type: 'deck_scatter',
    color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
    color_scheme: 'supersetColors',
    dimension: 'category',
    slice_id: 42,
    color_picker: { r: 0, g: 0, b: 0, a: 1 },
  } as unknown as QueryFormData;
  const data = [{ cat_color: 'A' }, { cat_color: 'B' }];

  const categories = getCategories(fd, data);
  const features = addColorToFeatures(data, fd);

  // Both the legend path (getCategories) and the point-color path
  // (addColorToFeatures) key the color scale on the same slice id.
  expect(scaleCalls.length).toBeGreaterThan(0);
  scaleCalls.forEach(([, sliceId]) => {
    expect(sliceId).toBe(42);
  });

  // The legend swatch for each category matches the resolved point color.
  expect(categories.A.color).toEqual(features[0].color);
  expect(categories.B.color).toEqual(features[1].color);
  expect(features[0].color).not.toEqual(features[1].color);
});

test('reconcileCategories keeps the previous object when the categories are unchanged', () => {
  const previous = { A: { color: [1, 0, 0, 255], enabled: false } };
  const next = { A: { color: [1, 0, 0, 255], enabled: true } };

  expect(reconcileCategories(previous, next)).toBe(previous);
});

test('reconcileCategories adds new categories and keeps the chosen visibility', () => {
  const previous = {
    A: { color: [1, 0, 0, 255], enabled: false },
    B: { color: [0, 1, 0, 255], enabled: true },
  };
  const next = {
    A: { color: [1, 0, 0, 255], enabled: true },
    C: { color: [0, 0, 1, 255], enabled: true },
  };

  expect(reconcileCategories(previous, next)).toEqual({
    A: { color: [1, 0, 0, 255], enabled: false },
    C: { color: [0, 0, 1, 255], enabled: true },
  });
});

test('reconcileCategories shows every category rather than none', () => {
  const previous = {
    A: { color: [1, 0, 0, 255], enabled: false },
    B: { color: [0, 1, 0, 255], enabled: true },
  };
  const next = { A: { color: [1, 0, 0, 255], enabled: true } };

  expect(reconcileCategories(previous, next)).toEqual({
    A: { color: [1, 0, 0, 255], enabled: true },
  });
});

test('features of a category that first appears in a refreshed response are drawn', () => {
  const fd = {
    datasource: '1__table',
    viz_type: 'deck_scatter',
    color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
    color_scheme: 'supersetColors',
    dimension: 'category',
    slice_id: 42,
    color_picker: { r: 0, g: 0, b: 0, a: 1 },
  } as unknown as QueryFormData;
  const getLayer = jest.fn(() => ({}));
  const drawnCategories = () => {
    const { payload } = (
      getLayer.mock.calls.at(-1) as unknown as [JsonObject]
    )[0];
    return payload.data.features.map((f: JsonObject) => f.cat_color);
  };
  const props = {
    formData: fd,
    getLayer,
    getPoints: () => [],
    viewport: { longitude: 0, latitude: 0, zoom: 1 },
    width: 400,
    height: 300,
    setControlValue: jest.fn(),
    // The standalone v1 transforms build the payload from the query
    // response, which carries no form_data.
    payload: { data: { features: [{ cat_color: 'A' }] } },
  } as unknown as CategoricalDeckGLContainerProps;

  const { rerender } = render(
    <ThemeProvider theme={supersetTheme}>
      <CategoricalDeckGLContainer {...props} />
    </ThemeProvider>,
  );
  expect(drawnCategories()).toEqual(['A']);

  rerender(
    <ThemeProvider theme={supersetTheme}>
      <CategoricalDeckGLContainer
        {...props}
        payload={{
          data: { features: [{ cat_color: 'A' }, { cat_color: 'B' }] },
        }}
      />
    </ThemeProvider>,
  );
  expect(drawnCategories()).toEqual(['A', 'B']);
});

test.each([
  [true, 51.5],
  [false, 0],
])(
  'with autozoom %s a refreshed response leaves the map centered at latitude %s',
  (autozoom, expectedLatitude) => {
    const fd = {
      datasource: '1__table',
      viz_type: 'deck_scatter',
      autozoom,
    } as unknown as QueryFormData;
    const props = {
      formData: fd,
      getLayer: jest.fn(() => ({})),
      getPoints: (features: JsonObject[]) =>
        features.map(feature => feature.position),
      viewport: { longitude: 0, latitude: 0, zoom: 1 },
      width: 400,
      height: 300,
      setControlValue: jest.fn(),
      // The standalone v1 transforms build the payload from the query
      // response, which carries no form_data.
      payload: {
        data: {
          features: [
            { position: [-122.45, 37.75] },
            { position: [-122.4, 37.8] },
          ],
        },
      },
    } as unknown as CategoricalDeckGLContainerProps;

    const { rerender } = render(
      <ThemeProvider theme={supersetTheme}>
        <CategoricalDeckGLContainer {...props} />
      </ThemeProvider>,
    );
    expect(mockViewports.at(-1)?.latitude).toBeCloseTo(autozoom ? 37.775 : 0);

    rerender(
      <ThemeProvider theme={supersetTheme}>
        <CategoricalDeckGLContainer
          {...props}
          payload={{
            data: {
              features: [
                { position: [-0.15, 51.48] },
                { position: [-0.1, 51.52] },
              ],
            },
          }}
        />
      </ThemeProvider>,
    );
    expect(mockViewports.at(-1)?.latitude).toBeCloseTo(expectedLatitude, 1);
  },
);

test('with autozoom a tilt written back by Explore keeps the viewer on the same rows', () => {
  const positions = [
    [-122.45, 37.75],
    [-122.4, 37.8],
  ];
  const props = {
    formData: {
      datasource: '1__table',
      viz_type: 'deck_scatter',
      autozoom: true,
    } as unknown as QueryFormData,
    getLayer: jest.fn(() => ({})),
    getPoints: (features: JsonObject[]) =>
      features.map(feature => feature.position),
    viewport: { longitude: 0, latitude: 0, zoom: 1 },
    width: 400,
    height: 300,
    setControlValue: jest.fn(),
    payload: { data: { features: positions.map(position => ({ position })) } },
  } as unknown as CategoricalDeckGLContainerProps;

  const { rerender } = render(
    <ThemeProvider theme={supersetTheme}>
      <CategoricalDeckGLContainer {...props} />
    </ThemeProvider>,
  );
  const fitted = mockViewports.at(-1);

  // Explore saves the viewer's tilt through setControlValue, and the transform
  // re-runs on the same response, building a new features array.
  rerender(
    <ThemeProvider theme={supersetTheme}>
      <CategoricalDeckGLContainer
        {...props}
        viewport={{ longitude: -100, latitude: 20, zoom: 6, pitch: 40 }}
        payload={{
          data: { features: positions.map(position => ({ position })) },
        }}
      />
    </ThemeProvider>,
  );
  expect(mockViewports.at(-1)).toEqual(fitted);
});

test('rows with a null dimension get their own legend category', () => {
  const fd = {
    datasource: '1__table',
    viz_type: 'deck_scatter',
    color_scheme_type: COLOR_SCHEME_TYPES.categorical_palette,
    color_scheme: 'supersetColors',
    dimension: 'category',
    slice_id: 42,
    color_picker: { r: 0, g: 0, b: 0, a: 1 },
  } as unknown as QueryFormData;
  const data = [{ cat_color: 'A' }, { cat_color: NULL_CATEGORY_KEY }];

  const categories = getCategories(fd, data);

  expect(categories[NULL_CATEGORY_KEY]?.enabled).toBe(true);
  expect(categories[NULL_CATEGORY_KEY]?.color).toBeDefined();

  // Without a category entry the container drops the feature entirely, which is
  // how null-dimension rows used to disappear from the map.
  expect(data.filter(d => categories[d.cat_color]?.enabled)).toHaveLength(2);
});
