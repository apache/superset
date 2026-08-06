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
import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import DashboardProvider from 'src/core/dashboard/DashboardProvider';
import 'src/core/dashboard';
import Inspector from './Inspector';

const provider = DashboardProvider.getInstance();

beforeEach(() => {
  provider.reset();
});

const select = (type: string, props?: Record<string, unknown>) => {
  const id = provider.addBuildingBlock(provider.getRoot().id, 0, {
    type,
    ...(props ? { props } : {}),
  });
  provider.setSelection(id);
  render(<Inspector />);
  return id;
};

test('a markdown block placed a moment ago can still be given content', async () => {
  // The block arrives with no props at all. Waiting for a `content` key to
  // exist before offering the field is what left a fresh block with no way
  // to be given one.
  const id = select('markdown');

  await userEvent.type(
    screen.getByTestId('inspector-content'),
    'Quarterly review',
  );
  await userEvent.tab();

  expect(provider.getNode(id)?.props?.content).toBe('Quarterly review');
});

test('content a block already has is what the field shows', () => {
  select('markdown', { content: 'Welcome' });

  expect(screen.getByTestId('inspector-content')).toHaveValue('Welcome');
});

test('a block with no prose field is still authorable through its properties', () => {
  select('echarts');

  // A chart's dataBinding and echartsOptions have never had a hand-editing
  // path. They are just keys, and the general editor reaches every one.
  expect(screen.queryByTestId('inspector-content')).not.toBeInTheDocument();
  expect(screen.getByTestId('inspector-props')).toBeInTheDocument();
});

test('applying properties writes them to the block', async () => {
  const id = select('echarts');

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{"dataBinding":{"datasetId":3,"metrics":["count"]}}' },
  });
  await userEvent.click(screen.getByTestId('inspector-props-apply'));

  expect(provider.getNode(id)?.props?.dataBinding).toEqual({
    datasetId: 3,
    metrics: ['count'],
  });
});

test('a key deleted from the properties stops reaching the block', async () => {
  const id = select('echarts', { keep: 1, drop: 2 });

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{"keep":1}' },
  });
  await userEvent.click(screen.getByTestId('inspector-props-apply'));

  // `updateProps` merges, so omitting a key would silently do nothing and
  // the block would go on rendering from the value it appeared to lose.
  // Sending `undefined` is as close to a removal as a merge can express: the
  // block reads nothing there, and the key does not survive serialization
  // back into the editor.
  expect(provider.getNode(id)?.props?.drop).toBeUndefined();
  expect(provider.getNode(id)?.props?.keep).toBe(1);
  expect(screen.getByTestId('inspector-props')).toHaveValue(
    JSON.stringify({ keep: 1 }, null, 2),
  );
});

test('malformed properties cannot be applied, and stay on screen to be fixed', () => {
  const id = select('echarts', { kept: true });

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{ "broken": ' },
  });

  expect(screen.getByTestId('inspector-props-apply')).toBeDisabled();
  expect(screen.getByTestId('inspector-props-error')).toBeInTheDocument();
  // The draft is the author's; it is not reverted out from under them.
  expect(screen.getByTestId('inspector-props')).toHaveValue('{ "broken": ');
  expect(provider.getNode(id)?.props?.kept).toBe(true);
});

test('properties that are not an object are refused', () => {
  select('echarts');

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '[1, 2, 3]' },
  });

  expect(screen.getByTestId('inspector-props-apply')).toBeDisabled();
});

test('reverting restores what the block still has', async () => {
  select('echarts', { kept: true });

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{}' },
  });
  await userEvent.click(screen.getByTestId('inspector-props-revert'));

  expect(screen.getByTestId('inspector-props')).toHaveValue(
    JSON.stringify({ kept: true }, null, 2),
  );
});

test('the panel is set down from the tabs above it', () => {
  select('markdown');

  // Flush against the tab bar, the first line reads as a caption belonging
  // to the tabs rather than to the block it names.
  expect(screen.getByTestId('inspector')).toHaveStyle('padding-top: 12px');
});

test('the empty state is set down too', () => {
  render(<Inspector />);

  expect(screen.getByTestId('inspector-empty')).toHaveStyle(
    'padding-top: 12px',
  );
});
