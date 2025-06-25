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
import { ThemeProvider, supersetTheme } from '@superset-ui/core';
import { MetricOption, MetricOptionProps } from '../../src';

jest.mock('../../src/components/InfoTooltipWithTrigger', () => () => (
  <div data-test="mock-info-tooltip-with-trigger" />
));
jest.mock('../../src/components/ColumnTypeLabel/ColumnTypeLabel', () => ({
  ColumnTypeLabel: () => <div data-test="mock-column-type-label" />,
}));
jest.mock(
  '../../src/components/Tooltip',
  () =>
    ({ children }: { children: React.ReactNode }) => (
      <div data-test="mock-tooltip">{children}</div>
    ),
);
jest.mock('../../src/components/SQLPopover', () => ({
  SQLPopover: () => <div data-test="mock-sql-popover" />,
}));

const defaultProps = {
  metric: {
    metric_name: 'foo',
    verbose_name: 'Foo',
    expression: 'SUM(foo)',
    label: 'test',
    description: 'Foo is the greatest metric of all',
    warning_text: 'Be careful when using foo',
  },
  openInNewWindow: false,
  showFormula: true,
  showType: true,
  url: '',
};

const setup = (props: Partial<MetricOptionProps> = {}) =>
  render(
    <ThemeProvider theme={supersetTheme}>
      <MetricOption {...defaultProps} {...props} />
    </ThemeProvider>,
  );
test('shows a label with verbose_name', () => {
  const { container } = setup();
  const lbl = container.getElementsByClassName('option-label');
  expect(lbl).toHaveLength(1);
  expect(`${lbl[0].textContent}`).toEqual(defaultProps.metric.verbose_name);
});
test('shows a InfoTooltipWithTrigger', () => {
  const { getByTestId } = setup();
  expect(getByTestId('mock-info-tooltip-with-trigger')).toBeInTheDocument();
});
test('shows SQL Popover trigger', () => {
  const { getByTestId } = setup();
  expect(getByTestId('mock-sql-popover')).toBeInTheDocument();
});
test('shows a label with metric_name when no verbose_name', () => {
  const { getByText } = setup({
    metric: {
      ...defaultProps.metric,
      verbose_name: '',
    },
  });
  expect(getByText(defaultProps.metric.metric_name)).toBeInTheDocument();
});
test('doesnt show InfoTooltipWithTrigger when no warning', () => {
  const { queryByText } = setup({
    metric: {
      ...defaultProps.metric,
      warning_text: '',
    },
  });
  expect(queryByText('mock-info-tooltip-with-trigger')).not.toBeInTheDocument();
});
test('sets target="_blank" when openInNewWindow is true', () => {
  const { getByRole } = setup({
    url: 'https://github.com/apache/incubator-superset',
    openInNewWindow: true,
  });
  expect(
    getByRole('link', { name: defaultProps.metric.verbose_name }),
  ).toHaveAttribute('target', '_blank');
});
test('shows a metric type label when showType is true', () => {
  const { getByTestId } = setup({
    showType: true,
  });
  expect(getByTestId('mock-column-type-label')).toBeInTheDocument();
});
test('shows a Tooltip for the verbose metric name', () => {
  const { getByTestId } = setup();
  expect(getByTestId('mock-tooltip')).toBeInTheDocument();
});
