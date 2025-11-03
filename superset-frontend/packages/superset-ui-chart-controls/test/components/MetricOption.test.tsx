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
import { render } from '@superset-ui/core/spec';
import {
  MetricOption,
  MetricOptionProps,
} from '../../src/components/MetricOption';

jest.mock('@superset-ui/core/components/InfoTooltip', () => ({
  InfoTooltip: () => <div data-test="mock-tooltip" />,
}));

jest.mock(
  '@superset-ui/chart-controls/components/ColumnTypeLabel/ColumnTypeLabel',
  () => ({
    ColumnTypeLabel: () => <div data-test="mock-column-type-label" />,
  }),
);
jest.mock(
  '@superset-ui/core/components/Tooltip',
  () =>
    ({ children }: { children: React.ReactNode }) => (
      <div data-test="mock-tooltip">{children}</div>
    ),
);
jest.mock('@superset-ui/chart-controls/components/SQLPopover', () => ({
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
  render(<MetricOption {...defaultProps} {...props} />);
test('shows a label with verbose_name', () => {
  const { container } = setup();
  const lbl = container.getElementsByClassName('option-label');
  expect(lbl).toHaveLength(1);
  expect(`${lbl[0].textContent}`).toEqual(defaultProps.metric.verbose_name);
});
test('shows a InfoTooltip', () => {
  const { getByTestId } = setup();
  expect(getByTestId('mock-tooltip')).toBeInTheDocument();
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
test('doesnt show InfoTooltip when no warning', () => {
  const { queryByText } = setup({
    metric: {
      ...defaultProps.metric,
      warning_text: '',
    },
  });
  expect(queryByText('mock-tooltip')).not.toBeInTheDocument();
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
