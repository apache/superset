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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import CompactFilterTrigger from './CompactFilterTrigger';

// Base props without children — pass children as JSX to avoid no-children-prop lint rule.
const baseProps = {
  label: 'Owner',
  hasValue: false,
  onClear: jest.fn(),
};

const defaultChildren = jest.fn(() => (
  <div data-testid="filter-content">Filter content</div>
));

function renderTrigger(
  props: Partial<
    typeof baseProps & {
      hasValue: boolean;
      tooltipTitle?: string;
      popupType?: 'listbox' | 'dialog';
    }
  > = {},
  children = defaultChildren,
) {
  return render(
    <CompactFilterTrigger {...baseProps} {...props}>
      {children}
    </CompactFilterTrigger>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders the label', () => {
  renderTrigger();
  expect(screen.getByText('Owner')).toBeInTheDocument();
});

test('renders as inactive pill with down chevron when hasValue is false', () => {
  renderTrigger();
  const pill = screen.getByTestId('compact-filter-pill');
  expect(pill).toBeInTheDocument();
  // No clear button when inactive
  expect(screen.queryByTestId('compact-filter-clear')).not.toBeInTheDocument();
});

test('renders active state with clear icon when hasValue is true', () => {
  renderTrigger({ hasValue: true });
  expect(screen.getByTestId('compact-filter-clear')).toBeInTheDocument();
});

test('clear icon has descriptive aria-label matching the filter name', () => {
  renderTrigger({ hasValue: true });
  const clearIcon = screen.getByTestId('compact-filter-clear');
  expect(clearIcon).toHaveAttribute('aria-label', 'Clear Owner filter');
});

test('clear icon is rendered inside the pill button', () => {
  renderTrigger({ hasValue: true });
  const pill = screen.getByTestId('compact-filter-pill');
  const clearIcon = screen.getByTestId('compact-filter-clear');
  expect(pill).toContainElement(clearIcon);
});

test('toggles aria-expanded when pill is clicked', async () => {
  renderTrigger();
  const pill = screen.getByTestId('compact-filter-pill');
  expect(pill).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(pill);
  expect(pill).toHaveAttribute('aria-expanded', 'true');
});

test('calls onClear when clear icon is clicked', async () => {
  const onClear = jest.fn();
  renderTrigger({ hasValue: true, onClear } as any);
  const clearIcon = screen.getByTestId('compact-filter-clear');
  await userEvent.click(clearIcon);
  expect(onClear).toHaveBeenCalledTimes(1);
});

test('does not render tooltip wrapper when tooltipTitle is absent', () => {
  const { container } = renderTrigger();
  expect(container.querySelector('.ant-tooltip')).not.toBeInTheDocument();
});

test('shows active state indicators when hasValue and tooltipTitle are set', () => {
  renderTrigger({ hasValue: true, tooltipTitle: 'Some Owner' });
  expect(screen.getByTestId('compact-filter-clear')).toBeInTheDocument();
  expect(screen.getByTestId('compact-filter-pill')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('calls children render prop with isOpen and onClose', async () => {
  const children = jest.fn(() => <div data-testid="panel-content">panel</div>);
  renderTrigger({}, children);
  const pill = screen.getByTestId('compact-filter-pill');
  await userEvent.click(pill);
  expect(children).toHaveBeenCalledWith(
    expect.objectContaining({ isOpen: true, onClose: expect.any(Function) }),
  );
});

test('sets aria-haspopup to listbox by default', () => {
  renderTrigger();
  const pill = screen.getByTestId('compact-filter-pill');
  expect(pill).toHaveAttribute('aria-haspopup', 'listbox');
});

test('sets aria-haspopup to dialog when popupType is dialog', () => {
  renderTrigger({ popupType: 'dialog' });
  const pill = screen.getByTestId('compact-filter-pill');
  expect(pill).toHaveAttribute('aria-haspopup', 'dialog');
});

test('closing dropdown resets aria-expanded to false', async () => {
  renderTrigger();
  const pill = screen.getByTestId('compact-filter-pill');
  await userEvent.click(pill);
  expect(pill).toHaveAttribute('aria-expanded', 'true');
  await userEvent.click(pill);
  expect(pill).toHaveAttribute('aria-expanded', 'false');
});
