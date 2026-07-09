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
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import { DrillDownBreadcrumb } from './DrillDownBreadcrumb';
import { DrillDownLevel } from './types';

const hierarchy = ['country', 'region', 'city'];

const drillStack: DrillDownLevel[] = [
  {
    filters: [{ col: 'country', op: '==', val: 'USA' }],
    label: 'USA',
  },
  {
    filters: [{ col: 'region', op: '==', val: 'Texas' }],
    label: 'Texas',
  },
];

test('breadcrumb returns null when drillStack is empty and no selectedLeaf', () => {
  const { container } = render(
    <DrillDownBreadcrumb
      hierarchy={hierarchy}
      drillStack={[]}
      onJumpTo={jest.fn()}
    />,
  );

  expect(container.firstChild).toBeNull();
});

test('breadcrumb renders hierarchy[0] and drill labels', () => {
  render(
    <DrillDownBreadcrumb
      hierarchy={hierarchy}
      drillStack={drillStack}
      onJumpTo={jest.fn()}
    />,
  );

  // The root column name should be rendered
  expect(screen.getByText('country')).toBeInTheDocument();
  // Drill labels should be rendered
  expect(screen.getByText('USA')).toBeInTheDocument();
  expect(screen.getByText('Texas')).toBeInTheDocument();
});

test('clicking a breadcrumb segment calls onJumpTo with correct depth', () => {
  const onJumpTo = jest.fn();

  render(
    <DrillDownBreadcrumb
      hierarchy={hierarchy}
      drillStack={drillStack}
      onJumpTo={onJumpTo}
    />,
  );

  // Click the root segment (hierarchy[0]) — should call onJumpTo(0)
  fireEvent.click(screen.getByText('country'));
  expect(onJumpTo).toHaveBeenCalledWith(0);

  // Click the first drill label 'USA' — should call onJumpTo(1)
  fireEvent.click(screen.getByText('USA'));
  expect(onJumpTo).toHaveBeenCalledWith(1);
});

test('clickable breadcrumb segments are native buttons (keyboard accessible)', () => {
  render(
    <DrillDownBreadcrumb
      hierarchy={hierarchy}
      drillStack={drillStack}
      onJumpTo={jest.fn()}
    />,
  );

  // Clickable segments render as a native <button>, which the browser makes
  // operable via Enter/Space and focusable without hand-rolled a11y handlers.
  expect(screen.getByText('country').tagName).toBe('BUTTON');
  expect(screen.getByText('USA').tagName).toBe('BUTTON');
});

test('selectedLeaf is rendered as non-clickable text', () => {
  const onJumpTo = jest.fn();

  render(
    <DrillDownBreadcrumb
      hierarchy={hierarchy}
      drillStack={drillStack}
      selectedLeaf="Austin"
      onJumpTo={onJumpTo}
    />,
  );

  expect(screen.getByText('Austin')).toBeInTheDocument();

  // The leaf should not have role="button"
  const leafElement = screen.getByText('Austin');
  expect(leafElement).not.toHaveAttribute('role', 'button');
});

test('last drill label is not clickable when there is no selectedLeaf', () => {
  const onJumpTo = jest.fn();

  render(
    <DrillDownBreadcrumb
      hierarchy={hierarchy}
      drillStack={drillStack}
      onJumpTo={onJumpTo}
    />,
  );

  // 'Texas' is the last item and no selectedLeaf, so it should not be clickable
  const texasElement = screen.getByText('Texas');
  expect(texasElement).not.toHaveAttribute('role', 'button');

  fireEvent.click(texasElement);
  // onJumpTo should only have been called for the root click test, not for Texas
  expect(onJumpTo).not.toHaveBeenCalled();
});
