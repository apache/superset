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
import { useEffect, useState } from 'react';
import { dashboard as dashboardApi } from '@apache-superset/core';
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import { WidgetBusContext, createWidgetBus } from '../bus';
import { WidgetDataClientContext } from '../dataClient';
import { unregisterWidgetComponent } from '../registry';
import type { WidgetBus, WidgetDataClient } from '../types';
import { createExtensionCore, resetExtensionHost } from './extensionHost';
import { Widget } from './Widget';

const TYPE = 'extensions.acme.widgets.chart';

// The extension's own module: it sees nothing but `@apache-superset/core`.
const core = createExtensionCore({ id: 'acme.widgets', name: 'widgets' });

function ExtensionChart({ nodeId }: { nodeId: string }) {
  const node = core.dashboard.getNode(nodeId);
  const label = String(node?.props?.label ?? '');
  const [rows, setRows] = useState<number>();

  useEffect(() => {
    core.dashboard
      .fetchQueryData({ datasetId: 7, metrics: ['count'] })
      .then(result => setRows(result.rows.length));
  }, []);

  return (
    <button
      type="button"
      data-test="ext"
      onClick={() =>
        core.dashboard.emit(nodeId, dashboardApi.VALUE_CHANGED_EVENT, {
          selection: ['CA'],
          resolved: {
            column: 'state',
            operator: 'IN',
            value: ['CA'],
            datasource: 7,
          },
        })
      }
    >
      {label}:{rows ?? '-'}
    </button>
  );
}

let bus: WidgetBus;
let client: WidgetDataClient;

beforeEach(() => {
  bus = createWidgetBus();
  client = {
    fetchData: jest.fn(async () => ({
      columns: ['count'],
      rows: [{ count: 1 }, { count: 2 }],
    })),
    fetchValues: jest.fn(),
  };
  core.views.registerView(
    { id: TYPE, name: 'Chart', description: '' },
    'dashboard.widgets',
    ExtensionChart,
  );
});

afterEach(() => {
  unregisterWidgetComponent(TYPE);
  resetExtensionHost();
});

const renderWidget = () =>
  render(
    <WidgetBusContext.Provider value={bus}>
      <WidgetDataClientContext.Provider value={client}>
        <Widget type={TYPE} props={{ label: 'Sales' }} instanceId="w1" />
      </WidgetDataClientContext.Provider>
    </WidgetBusContext.Provider>,
  );

test('an extension widget reads its props from the node the host rendered', async () => {
  renderWidget();

  expect(await screen.findByText('Sales:2')).toBeInTheDocument();
});

test('its query runs through the embedded data client, as an inline widget', async () => {
  renderWidget();

  await screen.findByText('Sales:2');
  expect(client.fetchData).toHaveBeenCalledWith({
    instanceId: 'w1',
    widget: {
      type: 'echarts',
      props: { dataBinding: { datasetId: 7, metrics: ['count'] } },
    },
    filters: [],
  });
});

test('a filter on the page narrows its query', async () => {
  bus.emit('host:state', dashboardApi.VALUE_CHANGED_EVENT, {
    selection: ['CA'],
    resolved: {
      column: 'state',
      operator: 'IN',
      value: ['CA'],
      datasource: 7,
    },
  });

  renderWidget();

  await screen.findByText('Sales:2');
  expect(client.fetchData).toHaveBeenCalledWith(
    expect.objectContaining({
      filters: [
        { column: 'state', operator: 'IN', value: ['CA'], datasource: 7 },
      ],
    }),
  );
});

test('what it emits reaches the page bus under its own instance id', async () => {
  renderWidget();

  fireEvent.click(await screen.findByTestId('ext'));

  expect(bus.getValue('w1', dashboardApi.VALUE_CHANGED_EVENT)).toEqual({
    selection: ['CA'],
    resolved: {
      column: 'state',
      operator: 'IN',
      value: ['CA'],
      datasource: 7,
    },
  });
});
