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
import { render } from '@testing-library/react';
import {
  ThemeProvider,
  supersetTheme,
  GenericDataType,
} from '@superset-ui/core';

import { ColumnOption, ColumnOptionProps } from '../../src';

jest.mock('../../src/components/SQLPopover', () => ({
  SQLPopover: () => <div data-test="mock-sql-popover" />,
}));
jest.mock('../../src/components/ColumnTypeLabel/ColumnTypeLabel', () => ({
  ColumnTypeLabel: ({ type }: { type: string }) => (
    <div data-test="mock-column-type-label">{type}</div>
  ),
}));
jest.mock('../../src/components/InfoTooltipWithTrigger', () => () => (
  <div data-test="mock-info-tooltip-with-trigger" />
));

const defaultProps: ColumnOptionProps = {
  column: {
    column_name: 'foo',
    verbose_name: 'Foo',
    expression: 'SUM(foo)',
    description: 'Foo is the greatest column of all',
  },
  showType: false,
};

const setup = (props: Partial<ColumnOptionProps> = {}) =>
  render(
    <ThemeProvider theme={supersetTheme}>
      <ColumnOption {...defaultProps} {...props} />
    </ThemeProvider>,
  );
test('shows a label with verbose_name', () => {
  const { container } = setup();
  const lbl = container.getElementsByClassName('option-label');
  expect(lbl).toHaveLength(1);
  expect(`${lbl[0].textContent}`).toEqual(defaultProps.column.verbose_name);
});
test('shows SQL Popover trigger', () => {
  const { getByTestId } = setup();
  expect(getByTestId('mock-sql-popover')).toBeInTheDocument();
});
test('shows a label with column_name when no verbose_name', () => {
  const { getByText } = setup({
    column: {
      ...defaultProps.column,
      verbose_name: undefined,
    },
  });
  expect(getByText(defaultProps.column.column_name)).toBeInTheDocument();
});
test('shows a column type label when showType is true', () => {
  const { getByTestId } = setup({
    showType: true,
    column: {
      column_name: 'foo',
      type: 'VARCHAR',
      type_generic: GenericDataType.String,
    },
  });
  expect(getByTestId('mock-column-type-label')).toBeInTheDocument();
});
test('column with expression has correct column label if showType is true', () => {
  const { getByTestId } = setup({
    showType: true,
  });
  expect(getByTestId('mock-column-type-label')).toBeInTheDocument();
  expect(getByTestId('mock-column-type-label')).toHaveTextContent('expression');
});
test('shows no column type label when type is null', () => {
  const { queryByTestId } = setup({
    showType: true,
    column: {
      column_name: 'foo',
    },
  });
  expect(queryByTestId('mock-column-type-label')).not.toBeInTheDocument();
});
test('dttm column has correct column label if showType is true', () => {
  const { getByTestId } = setup({
    showType: true,
    column: {
      ...defaultProps.column,
      expression: undefined,
      type_generic: GenericDataType.Temporal,
    },
  });
  expect(getByTestId('mock-column-type-label')).toBeInTheDocument();
  expect(getByTestId('mock-column-type-label')).toHaveTextContent(
    String(GenericDataType.Temporal),
  );
});
test('doesnt show InfoTooltipWithTrigger when no warning', () => {
  const { queryByText } = setup();
  expect(queryByText('mock-info-tooltip-with-trigger')).not.toBeInTheDocument();
});
test('shows a warning with InfoTooltipWithTrigger when it contains warning', () => {
  const { getByTestId } = setup({
    ...defaultProps,
    column: {
      ...defaultProps.column,
      warning_text: 'This is a warning',
    },
  });
  expect(getByTestId('mock-info-tooltip-with-trigger')).toBeInTheDocument();
});
