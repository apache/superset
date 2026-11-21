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
import { supersetTheme } from '@apache-superset/core/theme';
import { render, screen, userEvent, waitFor } from '@superset-ui/core/spec';
import { AntdThemeProvider } from '../AntdThemeProvider';
import { Checkbox } from '.';
import type { CheckboxProps } from './types';

const mockedProps: CheckboxProps = {
  checked: false,
  id: 'checkbox-id',
  onChange: jest.fn(),
  disabled: false,
  title: 'Checkbox title',
  indeterminate: false,
  children: 'Checkbox Label',
};

describe('Checkbox Component', () => {
  const asyncRender = (props = mockedProps) =>
    waitFor(() => render(<Checkbox {...props} />));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('should render correctly', async () => {
      const { container } = await asyncRender();
      expect(container).toBeInTheDocument();
    });

    test('should render the label', async () => {
      await asyncRender();
      expect(screen.getByText('Checkbox Label')).toBeInTheDocument();
    });

    test('should render the checkbox', async () => {
      await asyncRender();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });
  });

  describe('States', () => {
    test('should render as unchecked when checked is false', async () => {
      await asyncRender();
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    test('should render as checked when checked is true', async () => {
      const checkedProps = { ...mockedProps, checked: true };
      await asyncRender(checkedProps);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    test('should render as indeterminate when indeterminate is true', async () => {
      const indeterminateProps = { ...mockedProps, indeterminate: true };
      await asyncRender(indeterminateProps);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect((checkbox as HTMLInputElement).indeterminate).toBe(true);
    });

    test('should render as disabled when disabled prop is true', async () => {
      const disabledProps = { ...mockedProps, disabled: true };
      await asyncRender(disabledProps);
      expect(screen.getByRole('checkbox')).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    test('should call the onChange handler when clicked', async () => {
      await asyncRender();
      const checkbox = screen.getByRole('checkbox');
      await userEvent.click(checkbox);
      expect(mockedProps.onChange).toHaveBeenCalledTimes(1);
    });

    test('should not call the onChange handler when disabled and clicked', async () => {
      const mockOnChange = jest.fn();
      const disabledProps = {
        ...mockedProps,
        disabled: true,
        onChange: mockOnChange,
      };

      await asyncRender(disabledProps);
      const checkbox = screen.getByRole('checkbox');

      // The checkbox is disabled via `pointer-events: none`, so a real user
      // could never click it; explicitly opt out of user-event's pointer
      // events check to confirm the disabled checkbox still ignores clicks.
      await userEvent.click(checkbox, { pointerEventsCheck: 0 });

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    test('calls onChange handler successfully', async () => {
      const mockAction = jest.fn();
      render(<Checkbox checked={false} onChange={mockAction} />);
      const checkboxInput = screen.getByRole('checkbox');
      await userEvent.click(checkboxInput);
      expect(mockAction).toHaveBeenCalled();
    });
  });
});

test('Checkbox border uses colorTextTertiary for non-text contrast', () => {
  const { container } = render(<Checkbox />);
  const root = container.querySelector('[class*="-css-var"]') as Element;
  expect(getComputedStyle(root).getPropertyValue('--ant-color-border')).toBe(
    supersetTheme.colorTextTertiary,
  );
});

// Custom properties inherit; resolve the value the element actually uses.
const inheritedVar = (el: Element | null, name: string): string => {
  const value = el ? getComputedStyle(el).getPropertyValue(name) : '';
  return value || !el?.parentElement
    ? value
    : inheritedVar(el.parentElement, name);
};

test('disabled Checkbox keeps the default disabled border', () => {
  const { container } = render(<Checkbox disabled />);
  const box = container.querySelector('.ant-checkbox-disabled');
  expect(inheritedVar(box, '--ant-color-border')).toBe(
    supersetTheme.colorBorder,
  );
});

test('Checkbox in a disabled form keeps the default disabled border', () => {
  const { container } = render(
    <AntdThemeProvider componentDisabled>
      <Checkbox />
    </AntdThemeProvider>,
  );
  const box = container.querySelector('.ant-checkbox-disabled');
  expect(inheritedVar(box, '--ant-color-border')).toBe(
    supersetTheme.colorBorder,
  );
});

test('disabled options of an enabled Checkbox.Group keep the default border', () => {
  const { container } = render(
    <Checkbox.Group
      options={[
        { label: 'A', value: 'a', disabled: true },
        { label: 'B', value: 'b' },
      ]}
    />,
  );
  const [disabledBox, enabledBox] = Array.from(
    container.querySelectorAll('.ant-checkbox'),
  );
  expect(inheritedVar(disabledBox, '--ant-color-border')).toBe(
    supersetTheme.colorBorder,
  );
  expect(inheritedVar(enabledBox, '--ant-color-border')).toBe(
    supersetTheme.colorTextTertiary,
  );
});
