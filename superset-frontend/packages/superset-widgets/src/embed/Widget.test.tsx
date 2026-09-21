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
import { act } from 'react';
import { dashboard as dashboardApi } from '@apache-superset/core';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { WidgetBusContext, createWidgetBus } from '../bus';
import { WidgetDataClientContext } from '../dataClient';
import { registerWidgetComponent } from '../registry';
import type { WidgetBus, WidgetDataClient, WidgetProps } from '../types';
import { Widget } from './Widget';
import { ExtensionWidgetLoaderContext } from './extensionLoader';
import { useSupersetFilter } from './hooks';

const received: WidgetProps[] = [];

function StubWidget(widgetProps: WidgetProps) {
  received.push(widgetProps);
  return <div data-test="stub">{String(widgetProps.props.label ?? '')}</div>;
}

registerWidgetComponent('test.stub', StubWidget);

let bus: WidgetBus;
let client: WidgetDataClient;

beforeEach(() => {
  received.length = 0;
  bus = createWidgetBus();
  client = {
    fetchData: jest.fn(),
    fetchValues: jest.fn(),
    getSavedWidget: jest.fn(async (id: string) => ({
      uuid: id,
      widget_type: 'test.stub',
      props: { label: 'from server' },
    })),
  };
});

const renderInProviders = (ui: JSX.Element) =>
  render(
    <WidgetBusContext.Provider value={bus}>
      <WidgetDataClientContext.Provider value={client}>
        {ui}
      </WidgetDataClientContext.Provider>
    </WidgetBusContext.Provider>,
  );

test('a saved widget loads its definition, then renders with its saved id', async () => {
  renderInProviders(
    <Widget id="uuid-9" instanceId="w1" fallback={<span>loading</span>} />,
  );

  expect(screen.getByText('loading')).toBeInTheDocument();
  expect(await screen.findByText('from server')).toBeInTheDocument();
  expect(client.getSavedWidget).toHaveBeenCalledWith('uuid-9');
  expect(received.at(-1)).toEqual({
    instanceId: 'w1',
    props: { label: 'from server' },
    savedId: 'uuid-9',
  });
});

test('an inline widget renders immediately without a lookup', () => {
  renderInProviders(
    <Widget type="test.stub" props={{ label: 'inline' }} instanceId="w2" />,
  );

  expect(screen.getByText('inline')).toBeInTheDocument();
  expect(client.getSavedWidget).not.toHaveBeenCalled();
});

test('a failed lookup and an unknown type render errors', async () => {
  (client.getSavedWidget as jest.Mock).mockRejectedValueOnce(
    new Error('404: not found'),
  );
  renderInProviders(
    <>
      <Widget id="missing" renderError={error => <b>{error.message}</b>} />
      <Widget type="nope" />
    </>,
  );

  expect(await screen.findByText('404: not found')).toBeInTheDocument();
  expect(screen.getByText('Unknown widget type "nope"')).toBeInTheDocument();
});

test('a host filter is emitted on the bus and cleared on unmount', async () => {
  let setFilter: ReturnType<typeof useSupersetFilter> | undefined;
  function Host() {
    setFilter = useSupersetFilter('state');
    return null;
  }
  const { unmount } = renderInProviders(<Host />);

  act(() =>
    setFilter!({
      datasetId: 17,
      column: 'state',
      operator: 'IN',
      value: ['CA'],
      targets: ['w1'],
    }),
  );
  expect(bus.getValue('host:state', dashboardApi.VALUE_CHANGED_EVENT)).toEqual({
    selection: ['CA'],
    resolved: {
      column: 'state',
      operator: 'IN',
      value: ['CA'],
      datasource: 17,
    },
    targets: ['w1'],
  });

  unmount();
  await waitFor(() =>
    expect(
      bus.getValue('host:state', dashboardApi.VALUE_CHANGED_EVENT),
    ).toEqual({ selection: null, resolved: null }),
  );
});

test("an extension's widget type is loaded on demand, not shown as unknown", async () => {
  const load = jest.fn(async () => StubWidget);
  renderInProviders(
    <ExtensionWidgetLoaderContext.Provider value={load}>
      <Widget
        type="extensions.acme.widgets.funnel"
        props={{ label: 'from the extension' }}
        instanceId="w3"
        fallback={<span>loading</span>}
      />
    </ExtensionWidgetLoaderContext.Provider>,
  );

  expect(screen.getByText('loading')).toBeInTheDocument();
  expect(await screen.findByText('from the extension')).toBeInTheDocument();
  expect(load).toHaveBeenCalledWith('extensions.acme.widgets.funnel');
});

test('an extension that cannot be loaded says why', async () => {
  const load = jest.fn(async () => {
    throw new Error('Could not load the extension bundle.');
  });
  renderInProviders(
    <ExtensionWidgetLoaderContext.Provider value={load}>
      <Widget type="extensions.acme.widgets.funnel" instanceId="w4" />
    </ExtensionWidgetLoaderContext.Provider>,
  );

  expect(
    await screen.findByText('Could not load the extension bundle.'),
  ).toBeInTheDocument();
});

test('without a loader, an extension type says the page cannot load it', async () => {
  renderInProviders(
    <Widget type="extensions.acme.widgets.funnel" instanceId="w5" />,
  );

  expect(
    await screen.findByText(/which this page cannot load/),
  ).toBeInTheDocument();
});
