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
import { fireEvent, render } from '@superset-ui/core/spec';
import { InfoTooltip, InfoTooltipProps } from '@superset-ui/core/components';

jest.mock('@superset-ui/core/components/Tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-test="mock-tooltip">{children}</div>
  ),
}));

const defaultProps = {};

const setup = (props: Partial<InfoTooltipProps> = {}) =>
  render(<InfoTooltip {...defaultProps} {...props} />);

test('renders a tooltip', () => {
  const { getAllByTestId } = setup({
    label: 'test',
    tooltip: 'this is a test',
  });
  expect(getAllByTestId('mock-tooltip').length).toEqual(1);
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

test('finds the info circle icon inside info variant', () => {
  const { container } = setup({
    type: 'info',
  });

  const iconSpan = container.querySelector('svg[data-icon="info-circle"]');
  expect(iconSpan).toBeInTheDocument();
});

test('finds the warning icon inside warning variant', () => {
  const { container } = setup({
    type: 'warning',
  });

  const iconSpan = container.querySelector('svg[data-icon="warning"]');
  expect(iconSpan).toBeInTheDocument();
});

test('finds the close circle icon inside error variant', () => {
  const { container } = setup({
    type: 'error',
  });

  const iconSpan = container.querySelector('svg[data-icon="close-circle"]');
  expect(iconSpan).toBeInTheDocument();
});

test('finds the question circle icon inside question variant', () => {
  const { container } = setup({
    type: 'question',
  });

  const iconSpan = container.querySelector('svg[data-icon="question-circle"]');
  expect(iconSpan).toBeInTheDocument();
});

test('finds the thunderbolt icon inside notice variant', () => {
  const { container } = setup({
    type: 'notice',
  });

  const iconSpan = container.querySelector('svg[data-icon="thunderbolt"]');
  expect(iconSpan).toBeInTheDocument();
});
