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

import type { ReactNode } from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { render } from '@testing-library/react';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import { MVTLayer } from '@deck.gl/geo-layers';
import { MVTLoader } from '@loaders.gl/mvt';
import { getLayer } from './VectorTile';
import { VectorTileFormData } from './layerSettings';

// The real package pulls in an ES-module-only dependency Jest cannot load.
// A stand-in that keeps its props is enough to check what getLayer passes.
jest.mock('@deck.gl/geo-layers', () => ({
  MVTLayer: class {
    props: Record<string, unknown>;

    constructor(props: Record<string, unknown>) {
      this.props = props;
    }
  },
}));

// getLayer does not render a map; skip the map libraries it would load.
jest.mock('../../DeckGLContainer', () => ({
  DeckGLContainerStyledWrapper: () => null,
}));

const TILE_URL = 'http://localhost:3000/places/{z}/{x}/{y}';

type LayerOptions = Omit<
  Parameters<typeof getLayer>[0],
  'formData' | 'payload'
>;

/** Builds the layer from minimal form data plus the given fields. */
const layerFor = (
  overrides: Partial<VectorTileFormData> = {},
  options: Partial<LayerOptions> = {},
) =>
  getLayer({
    formData: {
      datasource: '1__table',
      viz_type: 'deck_vector_tile',
      slice_id: 7,
      tile_url: TILE_URL,
      ...overrides,
    } as VectorTileFormData,
    payload: {},
    setTooltip: jest.fn(),
    ...options,
  });

/** Hovers a tile feature with the given properties and renders the tooltip. */
const renderTooltip = (
  overrides: Partial<VectorTileFormData>,
  properties: Record<string, unknown>,
) => {
  const setTooltip = jest.fn();
  const layer = layerFor(overrides, { setTooltip })!;
  layer.props.onHover!(
    {
      picked: true,
      x: 0,
      y: 0,
      object: { type: 'Feature', properties },
    } as never,
    {} as never,
  );
  const { content } = setTooltip.mock.calls[0][0] as { content: ReactNode };
  return render(<ThemeProvider theme={supersetTheme}>{content}</ThemeProvider>);
};

test('returns no layer without a valid tile URL', () => {
  expect(layerFor({ tile_url: 'http://localhost:3000/places' })).toBeNull();
});

test('loads tiles from the URL within the zoom range', () => {
  const layer = layerFor({ min_zoom: 2, max_zoom: 12 })!;
  expect(layer).toBeInstanceOf(MVTLayer);
  expect(layer.props).toMatchObject({
    data: TILE_URL,
    minZoom: 2,
    maxZoom: 12,
  });
});

test('decodes tiles on the main thread, since the CSP blocks the CDN worker', () => {
  const { loaders, loadOptions } = layerFor()!.props;
  expect(loaders).toEqual([MVTLoader]);
  expect(loadOptions).toMatchObject({ core: { worker: false } });
});

test('decodes only the source layer when one is set', () => {
  expect(layerFor()!.props.loadOptions.mvt).toBeUndefined();
  expect(layerFor({ source_layer: 'places' })!.props.loadOptions.mvt).toEqual({
    layers: ['places'],
  });
});

test('passes a new tiles array each time the viewport loads', () => {
  const onViewportLoad = jest.fn();
  const tiles = [{ id: '0-0-0' }];
  layerFor({}, { onViewportLoad })!.props.onViewportLoad!(tiles as never);

  expect(onViewportLoad).toHaveBeenCalledWith(tiles);
  // A copy, so React re-renders the legend even if deck.gl reuses its array.
  expect(onViewportLoad.mock.calls[0][0]).not.toBe(tiles);
});

test('sets no viewport callback when none is given', () => {
  expect(layerFor()!.props.onViewportLoad).toBeFalsy();
});

test('the default tooltip lists properties but not the loader-added layerName', () => {
  const { container } = renderTooltip(
    {},
    { name: 'Cafe', layerName: 'places' },
  );
  expect(container.textContent).toContain('name: Cafe');
  expect(container.textContent).not.toContain('layerName');
});

test('the tooltip lists only the chosen properties', () => {
  const { container } = renderTooltip(
    { tooltip_properties: ['rating'] },
    { name: 'Cafe', rating: '4.5' },
  );
  expect(container.textContent).toContain('4.5');
  expect(container.textContent).not.toContain('Cafe');
});

test('tooltip templates can use property names directly', async () => {
  const { findByText } = renderTooltip(
    { tooltip_template: '<b>{{name}}</b>' },
    { name: 'Cafe' },
  );
  expect((await findByText('Cafe')).tagName).toBe('B');
});
