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
import { chat } from 'src/core/chat';
import ChatProvider from 'src/core/chat/ChatProvider';
import DashboardProvider from 'src/core/dashboard/DashboardProvider';
import { dashboardClientTools } from './clientTools';

beforeEach(() => {
  ChatProvider.getInstance().reset();
  DashboardProvider.getInstance().reset();
  chat.registerClientTools(dashboardClientTools);
});

async function execute(name: string, args: Record<string, unknown>) {
  const result = await chat.executeClientTool(name, args);
  return { ...result, value: JSON.parse(result.content) };
}

test('reads the blank Dashboard v2 tree', async () => {
  const result = await execute('dashboard_get_state', {});

  expect(result.isError).toBeUndefined();
  expect(result.value).toEqual({
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'canvas',
        layout: { columns: 24, gap: 16 },
        children: [],
      },
    },
  });
});

test('adds and edits a visible dashboard block', async () => {
  const added = await execute('dashboard_add_building_block', {
    parent_id: 'root',
    block: {
      type: 'markdown',
      layout: { colSpan: 12, rowSpan: 2 },
      props: { content: '# Revenue' },
    },
  });
  const id = added.value.node.id as string;

  await execute('dashboard_update_layout', {
    id,
    layout: { col: 3, row: 2, colSpan: 10 },
  });
  const updated = await execute('dashboard_update_props', {
    id,
    props: { content: '# Net revenue' },
  });

  expect(updated.value.node).toEqual(
    expect.objectContaining({
      id,
      layout: expect.objectContaining({ col: 3, row: 2, colSpan: 10 }),
      props: { content: '# Net revenue' },
    }),
  );
});

test('changes an ECharts palette without replacing the existing chart options', async () => {
  const provider = DashboardProvider.getInstance();
  const id = provider.addBuildingBlock('root', 0, {
    type: 'echarts',
    props: {
      dataBinding: { datasetId: 1, metrics: ['sum__sales'] },
      echartsOptions: {
        color: ['#old'],
        xAxis: { type: 'category' },
        series: [{ type: 'bar', data: [1, 2] }],
      },
    },
  });

  const updated = await execute('dashboard_update_props', {
    id,
    props: { echartsOptions: { color: ['#1677ff', '#52c41a'] } },
  });

  expect(updated.isError).toBeUndefined();
  expect(updated.value.node.props.echartsOptions).toEqual({
    color: ['#1677ff', '#52c41a'],
    xAxis: { type: 'category' },
    series: [{ type: 'bar', data: [1, 2] }],
  });
});

test('moves a block into a nested canvas and removes the subtree', async () => {
  const canvas = await execute('dashboard_add_building_block', {
    parent_id: 'root',
    block: { type: 'canvas', layout: { columns: 12, colSpan: 24 } },
  });
  const canvasId = canvas.value.node.id as string;
  const markdown = await execute('dashboard_add_building_block', {
    parent_id: 'root',
    block: { type: 'markdown', props: { content: 'Move me' } },
  });
  const markdownId = markdown.value.node.id as string;

  await execute('dashboard_move_building_block', {
    id: markdownId,
    new_parent_id: canvasId,
    new_index: 0,
  });
  let state = await execute('dashboard_get_state', {});
  expect(state.value.nodes[canvasId].children).toEqual([markdownId]);

  await execute('dashboard_remove_building_block', { id: canvasId });
  state = await execute('dashboard_get_state', {});
  expect(state.value.nodes[canvasId]).toBeUndefined();
  expect(state.value.nodes[markdownId]).toBeUndefined();
});

test('invalid model arguments become a client-tool error', async () => {
  const result = await chat.executeClientTool('dashboard_add_building_block', {
    parent_id: 'missing',
    block: { type: 'markdown' },
  });

  expect(result).toEqual({
    content:
      'Client tool "dashboard_add_building_block" failed: Parent "missing" is not a canvas node.',
    isError: true,
  });
});
