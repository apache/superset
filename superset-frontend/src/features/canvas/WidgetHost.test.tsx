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
import fetchMock from 'fetch-mock';
import { ComponentType, useContext } from 'react';
import { createPortal } from 'react-dom';
import type {
  CanvasRendererProps,
  SavedRendererProps,
} from 'src/core/canvas/types';
import { render as baseRender, screen } from 'spec/helpers/testing-library';
import { registerSavedWidgetRenderer, registerWidgetRenderer } from 'src/core';
import WidgetHost from './WidgetHost';
import { CanvasWidgetChromeContext } from './widgetChrome';

// The built-in renderers log their failures through redux.
const render: typeof baseRender = (ui, options) =>
  baseRender(ui, { useRedux: true, ...options });

const ID = '00000000-0000-4000-8000-0000000000aa';
const widgetEndpoint = `glob:*/api/v1/widget/${ID}`;
const dataEndpoint = `glob:*/api/v1/widget/${ID}/data`;

const saved = {
  uuid: ID,
  widget_type: 'test.saved',
  name: 'Revenue by region',
  schema_version: 2,
  props: { metric: 'revenue' },
};

const received: SavedRendererProps[] = [];

const Saved = (props: SavedRendererProps) => {
  received.push(props);
  return <div>{`saved ${String(props.props?.metric)}`}</div>;
};

/** A widget that puts its own control where the canvas keeps them. */
const WithControls = () => {
  const chrome = useContext(CanvasWidgetChromeContext);
  const button = <button type="button">More options</button>;
  return (
    <div>
      body
      {chrome ? createPortal(button, chrome) : button}
    </div>
  );
};

const Broken = () => {
  throw new Error('the renderer broke');
};

const disposables: { dispose: () => void }[] = [];
const register = (
  widgetType: string,
  renderer: ComponentType<SavedRendererProps>,
) => disposables.push(registerSavedWidgetRenderer(widgetType, renderer));

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  received.length = 0;
});

afterEach(() => {
  disposables.splice(0).forEach(registration => registration.dispose());
});

test('a saved widget renders in a canvas cell, under its name, as the only node of its filter bus', async () => {
  fetchMock.get(widgetEndpoint, { result: saved });
  register('test.saved', Saved);
  const filters = [
    {
      filterNodeId: 'page',
      value: { datasetId: 13, column: 'region', values: ['EMEA'] },
    },
  ];

  render(<WidgetHost widgetId={ID} filters={filters} refreshKey={2} />);

  const body = await screen.findByText('saved revenue');
  expect(screen.getByTestId('canvas-widget-title')).toHaveTextContent(
    'Revenue by region',
  );
  // The same boxes a canvas draws around a placement.
  const content = body.closest('.canvas-content');
  expect(content?.parentElement).toHaveClass('canvas-interactive');
  expect(content?.nextElementSibling).toHaveClass('canvas-chrome');

  const props = received.at(-1);
  expect(props?.canvasId).toBeUndefined();
  expect(props).toMatchObject({
    nodeId: ID,
    widgetId: ID,
    widgetType: 'test.saved',
    schemaVersion: 2,
    props: { metric: 'revenue' },
    title: 'Revenue by region',
    filters,
    crossFilters: [],
    customizations: [],
    crossFiltersEnabled: false,
    events: [],
    childNodes: [],
    refreshKey: 2,
  });
  // Nothing it publishes reaches another node, and nothing breaks.
  expect(() => props?.setCrossFilter({ any: 'value' })).not.toThrow();
  expect(() => props?.publish('acme.highlight', 1)).not.toThrow();
  expect(props?.renderGrid()).toBeNull();
});

test('a page that heads itself with the name leaves the title row out', async () => {
  fetchMock.get(widgetEndpoint, { result: saved });
  register('test.saved', Saved);

  render(<WidgetHost widgetId={ID} showTitle={false} />);

  expect(await screen.findByText('saved revenue')).toBeInTheDocument();
  expect(screen.queryByTestId('canvas-widget-title')).not.toBeInTheDocument();
  expect(received.at(-1)?.title).toBeUndefined();
});

test("a widget's own controls render beside its content, where a canvas puts them", async () => {
  fetchMock.get(widgetEndpoint, { result: saved });
  register('test.saved', WithControls);

  render(<WidgetHost widgetId={ID} />);

  const controls = await screen.findByRole('button', { name: 'More options' });
  expect(controls.closest('.canvas-chrome')).not.toBeNull();
  expect(controls.closest('.canvas-content')).toBeNull();
});

test('a widget that does not exist, or that the viewer may not read, says so', async () => {
  fetchMock.get(widgetEndpoint, 404);

  render(<WidgetHost widgetId={ID} />);

  expect(
    await screen.findByText(
      'This widget does not exist, or you do not have access to it',
    ),
  ).toBeInTheDocument();
});

test('a type that renders only on a canvas is unavailable outside one', async () => {
  fetchMock.get(widgetEndpoint, { result: saved });
  const placed = jest.fn((props: CanvasRendererProps) => (
    <div>{`placed on ${props.canvasId}`}</div>
  ));
  disposables.push(registerWidgetRenderer('test.saved', placed));

  render(<WidgetHost widgetId={ID} />);

  expect(
    await screen.findByText('This widget is unavailable'),
  ).toBeInTheDocument();
  // A canvas renderer is always given its canvas, so it never runs here.
  expect(placed).not.toHaveBeenCalled();
});

test('a widget type with no renderer gets the placeholder a canvas shows', async () => {
  fetchMock.get(widgetEndpoint, {
    result: { ...saved, widget_type: 'test.nobody' },
  });

  render(<WidgetHost widgetId={ID} />);

  expect(
    await screen.findByText('This widget is unavailable'),
  ).toBeInTheDocument();
  // The type id means nothing to a viewer.
  expect(screen.queryByText(/test\.nobody/)).not.toBeInTheDocument();
  expect(screen.getByTestId('canvas-widget-title')).toHaveTextContent(
    'Revenue by region',
  );
});

test('a renderer that throws is contained in its cell', async () => {
  fetchMock.get(widgetEndpoint, { result: saved });
  register('test.saved', Broken);
  // React reports the error it caught; the boundary is what is under test.
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

  render(<WidgetHost widgetId={ID} />);

  expect(await screen.findByTestId('canvas-widget-title')).toHaveTextContent(
    'Revenue by region',
  );
  expect(await screen.findByText(/the renderer broke/)).toBeInTheDocument();
  spy.mockRestore();
});

test("a built-in widget on its own reads the saved widget's data", async () => {
  fetchMock.get(widgetEndpoint, {
    result: {
      ...saved,
      widget_type: 'metric-tile',
      props: {
        dataBinding: { datasetId: 13, metrics: ['revenue'] },
        label: 'Revenue',
      },
    },
  });
  fetchMock.post(dataEndpoint, {
    result: { datasets: [{ inline_data: [{ revenue: 42 }] }] },
  });

  render(
    <WidgetHost
      widgetId={ID}
      filters={[
        {
          filterNodeId: 'page',
          value: { datasetId: 13, column: 'region', values: ['EMEA'] },
        },
      ]}
    />,
  );

  expect(await screen.findByText('42')).toBeInTheDocument();
  const call = fetchMock.callHistory.lastCall(dataEndpoint);
  expect(JSON.parse(call?.options.body as string)).toEqual({
    runtime_filters: [{ datasetId: 13, column: 'region', values: ['EMEA'] }],
  });
});
