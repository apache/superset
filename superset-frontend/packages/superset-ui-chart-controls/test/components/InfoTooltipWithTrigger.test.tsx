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
import '@testing-library/jest-dom';
import { fireEvent, render } from '@testing-library/react';
import { ThemeProvider, supersetTheme, hexToRgb } from '@superset-ui/core';
import { InfoTooltipWithTrigger, InfoTooltipWithTriggerProps } from '../../src';

jest.mock('../../src/components/Tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-test="mock-tooltip">{children}</div>
  ),
}));

const defaultProps = {};

const setup = (props: Partial<InfoTooltipWithTriggerProps> = {}) =>
  render(
    <ThemeProvider theme={supersetTheme}>
      <InfoTooltipWithTrigger {...defaultProps} {...props} />
    </ThemeProvider>,
  );

test('renders a tooltip', () => {
  const { getAllByTestId } = setup({
    label: 'test',
    tooltip: 'this is a test',
  });
  expect(getAllByTestId('mock-tooltip').length).toEqual(1);
});

test('renders an info antd icon', () => {
  const { container } = setup();
  const iconElement = container.querySelector('svg');
  expect(iconElement).not.toBeNull();
});

test('responds to keydown events', () => {
  const clickHandler = jest.fn();
  const { getByRole } = setup({
    label: 'test',
    tooltip: 'this is a test',
    onClick: clickHandler,
  });

  fireEvent.keyDown(getByRole('button'), {
    key: 'Tab',
    code: 9,
    charCode: 9,
  });
  expect(clickHandler).toHaveBeenCalledTimes(0);

  fireEvent.keyDown(getByRole('button'), {
    key: 'Enter',
    code: 13,
    charCode: 13,
  });
  expect(clickHandler).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(getByRole('button'), {
    key: ' ',
    code: 32,
    charCode: 32,
  });
  expect(clickHandler).toHaveBeenCalledTimes(2);
});

test('applies info color based on theme token', () => {
  const { container } = setup({
    type: 'info',
    iconStyle: { color: supersetTheme.colorInfo },
  });

  const buttonSpan = container.querySelector(
    'span[role="button"]',
  ) as HTMLElement;
  expect(buttonSpan).toBeInTheDocument();
  expect(buttonSpan.style.color).toBe(hexToRgb(supersetTheme.colorIcon));
});

test('applies warning color based on theme token', () => {
  const { container } = setup({
    type: 'info',
    iconStyle: { color: supersetTheme.colorWarning },
  });

  const buttonSpan = container.querySelector(
    'span[role="button"]',
  ) as HTMLElement;
  expect(buttonSpan).toBeInTheDocument();
  expect(buttonSpan.style.color).toBe(hexToRgb(supersetTheme.colorWarning));
});

test('applies error color based on theme token', () => {
  const { container } = setup({
    type: 'info',
    iconStyle: { color: supersetTheme.colorError },
  });

  const buttonSpan = container.querySelector(
    'span[role="button"]',
  ) as HTMLElement;
  expect(buttonSpan).toBeInTheDocument();
  expect(buttonSpan.style.color).toBe(hexToRgb(supersetTheme.colorError));
});
