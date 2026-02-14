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
import type { ReactNode } from 'react';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import JSEditorControl from 'src/explore/components/controls/JSEditorControl';

jest.mock('react-virtualized-auto-sizer', () => ({
  __esModule: true,
  default: ({
    children,
  }: {
    children: (params: { width: number; height: number }) => ReactNode;
  }) => children({ width: 500, height: 250 }),
}));

jest.mock('src/core/editors', () => ({
  EditorHost: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      data-test="js-editor"
      defaultValue={value}
      onChange={e => onChange?.(e.target.value)}
    />
  ),
}));

jest.mock('src/hooks/useDebounceValue', () => ({
  useDebounceValue: (value: string) => value,
}));

const defaultProps = {
  name: 'echartOptions',
  label: 'EChart Options',
  onChange: jest.fn(),
  value: '',
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders the control with label', () => {
  render(<JSEditorControl {...defaultProps} />);
  expect(screen.getByText('EChart Options')).toBeInTheDocument();
});

test('renders the editor', () => {
  render(<JSEditorControl {...defaultProps} />);
  expect(screen.getByTestId('js-editor')).toBeInTheDocument();
});

test('renders with initial value', () => {
  const value = "{ title: { text: 'Test' } }";
  render(<JSEditorControl {...defaultProps} value={value} />);
  const editor = screen.getByTestId('js-editor');
  expect(editor).toHaveValue(value);
});

test('calls onChange when editor content changes', async () => {
  render(<JSEditorControl {...defaultProps} />);
  const editor = screen.getByTestId('js-editor');
  await userEvent.type(editor, '{ }');
  expect(defaultProps.onChange).toHaveBeenCalled();
});

test('displays validation error for invalid syntax', () => {
  const invalidValue = '{ invalid syntax';
  render(<JSEditorControl {...defaultProps} value={invalidValue} />);
  expect(screen.getByTestId('error-tooltip')).toBeInTheDocument();
});

test('displays validation error for function expressions', () => {
  const valueWithFunction = '{ formatter: () => {} }';
  render(<JSEditorControl {...defaultProps} value={valueWithFunction} />);
  expect(screen.getByTestId('error-tooltip')).toBeInTheDocument();
});

test('does not display error for valid EChart options', () => {
  const validValue = "{ title: { text: 'Valid Chart' }, grid: { top: 50 } }";
  render(<JSEditorControl {...defaultProps} value={validValue} />);
  expect(screen.queryByTestId('error-tooltip')).not.toBeInTheDocument();
});

test('does not display error for empty value', () => {
  render(<JSEditorControl {...defaultProps} value="" />);
  expect(screen.queryByTestId('error-tooltip')).not.toBeInTheDocument();
});

test('does not display error for undefined value', () => {
  render(<JSEditorControl {...defaultProps} value={undefined} />);
  expect(screen.queryByTestId('error-tooltip')).not.toBeInTheDocument();
});

test('renders with description tooltip', () => {
  const description = 'Custom EChart configuration options';
  render(<JSEditorControl {...defaultProps} description={description} />);
  expect(screen.getByText('EChart Options')).toBeInTheDocument();
});

test('uses name as label when label is not provided', () => {
  const props = { ...defaultProps, label: undefined };
  render(<JSEditorControl {...props} />);
  expect(screen.getByText('echartOptions')).toBeInTheDocument();
});
