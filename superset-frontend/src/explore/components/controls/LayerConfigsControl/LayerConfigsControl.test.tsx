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
import { SupersetClient, QueryFormData } from '@superset-ui/core';
import { getChartBuildQueryRegistry } from '@superset-ui/core/chart';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import LayerConfigsControl from './LayerConfigsControl';
import { LayerConf, WmsLayerConf } from './types';

const wms = (
  title: string,
  url: string,
  overrides: Partial<WmsLayerConf> = {},
): LayerConf => ({
  type: 'WMS',
  version: '1.3.0',
  title,
  url,
  layersParam: title.toLowerCase(),
  ...overrides,
});

// The layer type select is the first combobox in the form (the service
// version select follows it), so pick it by position.
const chooseLayerType = async (type: 'WMS' | 'WFS' | 'XYZ') => {
  const [typeSelect] = await screen.findAllByRole('combobox');
  await userEvent.click(typeSelect);
  await userEvent.click(await screen.findByTitle(type));
};

const existing = [wms('Roads', 'https://maps.example.com/wms')];

// The layer form reads the app locale and config from the bootstrap data.
beforeEach(() => {
  const app = document.createElement('div');
  app.id = 'app';
  app.setAttribute(
    'data-bootstrap',
    JSON.stringify({
      common: { conf: {}, menu_data: { navbar_right: { locale: 'en' } } },
    }),
  );
  document.body.appendChild(app);
});

afterEach(() => {
  document.getElementById('app')?.remove();
  jest.restoreAllMocks();
});

const setup = (value?: LayerConf[]) => {
  const onChange = jest.fn();
  render(
    <LayerConfigsControl
      name="layer_configs"
      label="Layers"
      value={value}
      onChange={onChange}
    />,
    { useDnd: true },
  );
  return { onChange };
};

test('renders the label and the add button', () => {
  setup([]);
  expect(screen.getByText('Layers')).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /Click to add new layer/ }),
  ).toBeInTheDocument();
});

test('lists each configured layer with its type and title', () => {
  setup([...existing, wms('Rivers', 'https://x.example.com')]);
  expect(screen.getAllByRole('button', { name: 'WMS' })).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Roads' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Rivers' })).toBeInTheDocument();
});

test('removing a layer emits the list without it', async () => {
  const { onChange } = setup([
    wms('Roads', 'https://a.example.com'),
    wms('Rivers', 'https://b.example.com'),
  ]);
  const [removeRoads] = screen.getAllByRole('button', { name: /close/i });
  await userEvent.click(removeRoads);
  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining(wms('Rivers', 'https://b.example.com')),
  ]);
});

test('adding a layer opens the form and prepends the saved layer', async () => {
  const { onChange } = setup(existing);
  await userEvent.click(
    screen.getByRole('button', { name: /Click to add new layer/ }),
  );
  expect(await screen.findByText('Add Layer')).toBeInTheDocument();

  await userEvent.type(
    screen.getByPlaceholderText('Insert Layer URL'),
    'https://new.example.com/wms',
  );
  await userEvent.type(
    screen.getByPlaceholderText('Insert Layer title'),
    'Parcels',
  );
  await userEvent.type(screen.getByPlaceholderText('Layer Name'), 'parcels');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({
      type: 'WMS',
      version: '1.3.0',
      title: 'Parcels',
      url: 'https://new.example.com/wms',
      layersParam: 'parcels',
      attribution: undefined,
    }),
    ...existing.map(l => expect.objectContaining(l)),
  ]);
});

test('editing a layer prefills the form and replaces the layer in place', async () => {
  // Rivers differs from the defaults so the save must carry its own fields.
  const { onChange } = setup([
    wms('Roads', 'https://a.example.com'),
    wms('Rivers', 'https://b.example.com', { version: '1.1.1' }),
  ]);
  await userEvent.click(screen.getByRole('button', { name: 'Rivers' }));
  const title = await screen.findByPlaceholderText('Insert Layer title');
  expect(title).toHaveValue('Rivers');

  await userEvent.clear(title);
  await userEvent.type(title, 'Lakes');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(onChange).toHaveBeenCalledTimes(1);
  const saved = onChange.mock.calls[0][0];
  expect(saved).toHaveLength(2);
  expect(saved[0].title).toBe('Roads');
  expect(saved[1]).toMatchObject({
    type: 'WMS',
    title: 'Lakes',
    url: 'https://b.example.com',
    version: '1.1.1',
    layersParam: 'rivers',
  });
});

test('closing the form does not emit a change', async () => {
  const { onChange } = setup(existing);
  await userEvent.click(
    screen.getByRole('button', { name: /Click to add new layer/ }),
  );
  await screen.findByText('Add Layer');
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onChange).not.toHaveBeenCalled();
});

test('adding a layer without an existing value emits a single-layer list', async () => {
  const { onChange } = setup(undefined);
  expect(screen.queryByRole('button', { name: 'WMS' })).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: /Click to add new layer/ }),
  );
  await userEvent.type(
    await screen.findByPlaceholderText('Insert Layer URL'),
    'https://new.example.com/wms',
  );
  await userEvent.type(
    screen.getByPlaceholderText('Insert Layer title'),
    'Parcels',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({
      type: 'WMS',
      title: 'Parcels',
      url: 'https://new.example.com/wms',
    }),
  ]);
});

test('removing the last layer emits an empty list', async () => {
  const { onChange } = setup([wms('Roads', 'https://a.example.com')]);
  await userEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onChange).toHaveBeenCalledWith([]);
});

test('adding an XYZ layer emits only the base fields', async () => {
  const { onChange } = setup([]);
  await userEvent.click(
    screen.getByRole('button', { name: /Click to add new layer/ }),
  );
  await screen.findByText('Add Layer');
  await chooseLayerType('XYZ');
  // XYZ layers have no service version or layer name.
  expect(screen.queryByPlaceholderText('Layer Name')).not.toBeInTheDocument();
  await userEvent.type(
    screen.getByPlaceholderText('Insert Layer URL'),
    // `{{` types a literal brace; a lone `{` starts a key descriptor.
    'https://tiles.example.com/{{z}/{{x}/{{y}.png',
  );
  await userEvent.type(
    screen.getByPlaceholderText('Insert Layer title'),
    'Tiles',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({
      type: 'XYZ',
      title: 'Tiles',
      url: 'https://tiles.example.com/{z}/{x}/{y}.png',
      attribution: undefined,
    }),
  ]);
});

test('adding a WFS layer emits its type name, version and feature limit', async () => {
  const { onChange } = setup([]);
  await userEvent.click(
    screen.getByRole('button', { name: /Click to add new layer/ }),
  );
  await screen.findByText('Add Layer');
  await chooseLayerType('WFS');
  await userEvent.type(
    screen.getByPlaceholderText('Insert Layer URL'),
    'https://features.example.com/wfs',
  );
  await userEvent.type(screen.getByPlaceholderText('Layer Name'), 'ns:parks');
  await userEvent.type(
    screen.getByPlaceholderText('Insert Layer title'),
    'Parks',
  );
  await userEvent.type(screen.getByPlaceholderText('10000'), '250');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(onChange).toHaveBeenCalledTimes(1);
  const [saved] = onChange.mock.calls[0][0];
  expect(saved).toMatchObject({
    type: 'WFS',
    title: 'Parks',
    url: 'https://features.example.com/wfs',
    typeName: 'ns:parks',
    version: '2.0.2',
    maxFeatures: 250,
  });
  expect(saved).not.toHaveProperty('layersParam');
});

test('dragging a layer onto another emits the reordered list', () => {
  const roads = wms('Roads', 'https://a.example.com');
  const rivers = wms('Rivers', 'https://b.example.com');
  const lakes = wms('Lakes', 'https://c.example.com');
  const { onChange } = setup([roads, rivers, lakes]);
  // The drag source and drop target is the DragContainer wrapping each item.
  const dragContainer = (title: string) =>
    // eslint-disable-next-line testing-library/no-node-access
    screen.getByRole('button', { name: title }).parentElement!.parentElement!;
  const source = dragContainer('Roads');
  const target = dragContainer('Lakes');

  fireEvent.dragStart(source);
  fireEvent.dragEnter(target);
  fireEvent.dragOver(target);
  fireEvent.drop(target);
  fireEvent.dragEnd(source);

  // jsdom reports empty layout rects, so the drop lands after the target.
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining(rivers),
    expect.objectContaining(lakes),
    expect.objectContaining(roads),
  ]);
});

const VIZ_TYPE = 'layer_configs_test_viz';
const chartQuery = { queries: [{ columns: ['geom'] }] };
const chartFormData = {
  viz_type: VIZ_TYPE,
  datasource: '1__table',
} as QueryFormData;
const featureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [1, 2] },
    },
  ],
};

const setupDataLayer = (
  props: Partial<React.ComponentProps<typeof LayerConfigsControl>> = {},
) => {
  getChartBuildQueryRegistry().registerValue(VIZ_TYPE, () => chartQuery as any);
  return render(
    <LayerConfigsControl
      name="layer_configs"
      label="Layers"
      value={[]}
      onChange={jest.fn()}
      formData={chartFormData}
      enableDataLayer
      {...props}
    />,
    { useDnd: true },
  );
};

afterEach(() => {
  getChartBuildQueryRegistry().remove(VIZ_TYPE);
});

test('fetches chart data through SupersetClient.post', async () => {
  const post = jest.spyOn(SupersetClient, 'post').mockResolvedValue({
    json: { result: [{ data: featureCollection }] },
  } as any);

  setupDataLayer();

  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenCalledWith({
    endpoint: '/api/v1/chart/data',
    jsonPayload: chartQuery,
    signal: expect.any(AbortSignal),
  });
});

test('passes the first result data and the form data to the transformer', async () => {
  jest.spyOn(SupersetClient, 'post').mockResolvedValue({
    json: { result: [{ data: featureCollection }] },
  } as any);
  const featureCollectionTransformer = jest.fn(data => data);

  setupDataLayer({ featureCollectionTransformer });

  await waitFor(() =>
    expect(featureCollectionTransformer).toHaveBeenCalledWith(
      featureCollection,
      chartFormData,
    ),
  );
});

test('does not request chart data when the data layer is disabled', () => {
  const post = jest.spyOn(SupersetClient, 'post');
  setupDataLayer({ enableDataLayer: false });
  expect(post).not.toHaveBeenCalled();
});

test('logs a failed request and does not call the transformer', async () => {
  const error = new Error('boom');
  jest.spyOn(SupersetClient, 'post').mockRejectedValue(error);
  const consoleError = jest.spyOn(console, 'error').mockImplementation();
  const featureCollectionTransformer = jest.fn();

  setupDataLayer({ featureCollectionTransformer });

  await waitFor(() =>
    expect(consoleError).toHaveBeenCalledWith(
      'Error fetching chart data for LayerConfigsControl',
      error,
    ),
  );
  expect(featureCollectionTransformer).not.toHaveBeenCalled();
});

test('aborts the in-flight request on unmount', async () => {
  const post = jest
    .spyOn(SupersetClient, 'post')
    .mockReturnValue(new Promise(() => {}) as any);

  const { unmount } = setupDataLayer();
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  const { signal } = post.mock.calls[0][0];
  expect(signal?.aborted).toBe(false);

  unmount();
  expect(signal?.aborted).toBe(true);
});
