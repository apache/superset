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
import { useEffect } from 'react';
import { act, waitFor } from 'spec/helpers/testing-library';
import { dashboard as dashboardApi } from '@apache-superset/core';
import { useWidgetBus } from '../bus';
import { useWidgetDataClient } from '../dataClient';
import { registerWidgetComponent } from '../registry';
import type { WidgetBus, WidgetDataClient, WidgetProps } from '../types';
import { createSession } from './session';

interface Seen {
  instanceId: string;
  bus: WidgetBus;
  client: WidgetDataClient;
}

const seen: Seen[] = [];

function Probe({ instanceId, props }: WidgetProps) {
  const bus = useWidgetBus();
  const client = useWidgetDataClient();
  useEffect(() => {
    seen.push({ instanceId, bus, client });
  }, [instanceId, bus, client]);
  return <span>{String(props.label ?? '')}</span>;
}

registerWidgetComponent('session-probe', Probe);

const stubClient: WidgetDataClient = {
  fetchData: jest.fn(async () => ({ columns: [], rows: [] })),
  fetchValues: jest.fn(async () => []),
};

function hostElement(): HTMLElement {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return element;
}

beforeEach(() => {
  seen.length = 0;
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

test('mounts widgets into host elements that share one bus and data client', async () => {
  const session = createSession({ client: stubClient, loadFonts: false });
  const first = hostElement();
  const second = hostElement();

  act(() => {
    session.mount(
      first,
      { type: 'session-probe', props: { label: 'one' } },
      { instanceId: 'a' },
    );
    session.mount(
      second,
      { type: 'session-probe', props: { label: 'two' } },
      { instanceId: 'b' },
    );
  });

  await waitFor(() => expect(seen).toHaveLength(2));
  expect(first).toHaveTextContent('one');
  expect(second).toHaveTextContent('two');
  expect(seen[0].bus).toBe(seen[1].bus);
  expect(seen[0].client).toBe(stubClient);
  expect(seen[1].client).toBe(stubClient);

  act(() => session.dispose());
});

test('host filters reach the bus and listeners can unsubscribe', () => {
  const session = createSession({ client: stubClient, loadFonts: false });
  const listener = jest.fn();
  const off = session.on(dashboardApi.VALUE_CHANGED_EVENT, listener);

  session.setFilter('state', {
    datasetId: 17,
    column: 'state',
    operator: 'IN',
    value: ['CA'],
  });

  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({
      nodeId: 'host:state',
      payload: expect.objectContaining({
        resolved: expect.objectContaining({
          column: 'state',
          value: ['CA'],
          datasource: 17,
        }),
      }),
    }),
  );

  off();
  session.setFilter('state', null);
  expect(listener).toHaveBeenCalledTimes(1);
  session.dispose();
});

test('dispose clears host filters, unmounts widgets and refuses new mounts', async () => {
  const session = createSession({ client: stubClient, loadFonts: false });
  const element = hostElement();
  const listener = jest.fn();
  session.on(dashboardApi.VALUE_CHANGED_EVENT, listener);

  act(() => {
    session.mount(element, { type: 'session-probe', props: { label: 'x' } });
  });
  await waitFor(() => expect(element).toHaveTextContent('x'));
  session.setFilter('state', {
    datasetId: 17,
    column: 'state',
    operator: 'EQUALS',
    value: 'CA',
  });

  act(() => session.dispose());

  expect(element).toBeEmptyDOMElement();
  expect(listener).toHaveBeenLastCalledWith(
    expect.objectContaining({
      nodeId: 'host:state',
      payload: { selection: null, resolved: null },
    }),
  );
  expect(() =>
    session.mount(hostElement(), { type: 'session-probe', props: {} }),
  ).toThrow('disposed');
});

test('uses the viewer connector through MCP when no client is given', async () => {
  const callTool = jest.fn(async () => ({
    structuredContent: { result: { columns: ['x'], rows: [{ x: 1 }] } },
  }));
  const session = createSession({
    server: 'Superset',
    mcp: { callTool },
    loadFonts: false,
  });

  act(() => {
    session.mount(hostElement(), { type: 'session-probe', props: {} });
  });
  await waitFor(() => expect(seen).toHaveLength(1));

  await seen[0].client
    .fetchData({
      instanceId: seen[0].instanceId,
      widget: { type: 'echarts', props: {} },
      filters: [],
    })
    .catch(() => undefined);

  expect(callTool).toHaveBeenCalledWith(
    'Superset',
    'get_widget_data',
    expect.anything(),
  );
  act(() => session.dispose());
});

test('needs a connector name or a client', () => {
  expect(() => createSession({})).toThrow('server');
});

test('rejects a duplicate instanceId', () => {
  const session = createSession({ client: stubClient, loadFonts: false });
  act(() => {
    session.mount(
      hostElement(),
      { type: 'session-probe', props: {} },
      {
        instanceId: 'same',
      },
    );
  });
  expect(() =>
    session.mount(
      hostElement(),
      { type: 'session-probe', props: {} },
      {
        instanceId: 'same',
      },
    ),
  ).toThrow('already mounted');
  act(() => session.dispose());
});

test('adds the font stylesheet once across sessions', () => {
  const first = createSession({ client: stubClient });
  const second = createSession({ client: stubClient });

  expect(document.querySelectorAll('#superset-widgets-fonts')).toHaveLength(1);

  first.dispose();
  second.dispose();
});

test('theme changes re-render mounted widgets in place', async () => {
  const session = createSession({ client: stubClient, loadFonts: false });
  const element = hostElement();
  act(() => {
    session.mount(element, {
      type: 'session-probe',
      props: { label: 'kept' },
    });
  });
  await waitFor(() => expect(element).toHaveTextContent('kept'));

  act(() => session.setThemeMode('dark'));

  expect(element).toHaveTextContent('kept');
  act(() => session.dispose());
});
