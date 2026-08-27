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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import DashboardProvider from '../DashboardProvider';
import { registerBuiltInWidgets } from '../registerBuiltInWidgets';
import { FILTER_BAR_APPLY_EVENT } from '../filterVocabulary';
import FilterBarWidget from './FilterBarWidget';

const provider = DashboardProvider.getInstance();

beforeAll(() => {
  registerBuiltInWidgets();
});

beforeEach(() => {
  provider.reset();
});

const createBar = (): string =>
  provider.addWidget(provider.getRoot().id, 0, { type: 'filter.bar' });

test('an empty bar invites adding a filter from the Palette', () => {
  const barId = createBar();
  render(<FilterBarWidget nodeId={barId} />);

  expect(screen.getByText('No filters yet')).toBeVisible();
});

test('a child added through the Palette is an ordinary filter.select node', () => {
  const barId = createBar();
  const childId = provider.addWidget(barId, 0, {
    type: 'filter.select',
    props: {},
  });

  expect(provider.getNode(barId)?.children).toEqual([childId]);
  expect(provider.getNode(childId)?.type).toBe('filter.select');
  // A filter.bar is a plain arranging container — nothing about how a
  // child is added, removed, or configured is special to it.
  expect(provider.getParentId(childId)).toBe(barId);
});

test('horizontal orientation gives each filter a fixed width; vertical gives it the full width', () => {
  const barId = createBar();
  const childId = provider.addWidget(barId, 0, {
    type: 'filter.select',
    props: {},
  });

  const { rerender } = render(<FilterBarWidget nodeId={barId} />);
  const itemWrapper = () =>
    screen
      .getByTestId(`filter-bar-${barId}`)
      .querySelector<HTMLElement>(`[data-node-id="${childId}"]`) as HTMLElement;

  expect(itemWrapper().style.width).not.toBe('100%');

  provider.updateProps(barId, { orientation: 'vertical' });
  rerender(<FilterBarWidget nodeId={barId} />);
  expect(itemWrapper().style.width).toBe('100%');
});

test('a child renders as just its name and its own control — no card, no header, no remove button', () => {
  const barId = createBar();
  const childId = provider.addWidget(barId, 0, {
    type: 'filter.select',
    props: { column: 'region', datasetId: 7, options: ['east', 'west'] },
  });
  render(<FilterBarWidget nodeId={barId} />);

  expect(screen.getByText('region')).toBeVisible();
  expect(screen.getByRole('combobox')).toBeVisible();
  expect(
    screen.queryByTestId(`widget-header-${childId}`),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId(`widget-remove-${childId}`),
  ).not.toBeInTheDocument();
});

test('the Apply button only appears once there is something to apply', () => {
  const barId = createBar();
  render(<FilterBarWidget nodeId={barId} />);
  expect(
    screen.queryByTestId(`filter-bar-apply-${barId}`),
  ).not.toBeInTheDocument();
});

test("the bar's Apply button fires the apply event on the bar's own id, not a child's", () => {
  const barId = createBar();
  provider.addWidget(barId, 0, { type: 'filter.select', props: {} });
  const received: string[] = [];
  provider.on(FILTER_BAR_APPLY_EVENT, event => received.push(event.nodeId));

  render(<FilterBarWidget nodeId={barId} />);
  fireEvent.click(screen.getByTestId(`filter-bar-apply-${barId}`));

  expect(received).toEqual([barId]);
});
