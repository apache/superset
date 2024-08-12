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
import userEvent from '@testing-library/user-event';
import { render, screen, selectOption } from 'spec/helpers/testing-library';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import AdhocMetricEditPopover from '.';

const createProps = () => ({
  onChange: jest.fn(),
  onClose: jest.fn(),
  onResize: jest.fn(),
  getCurrentTab: jest.fn(),
  getCurrentLabel: jest.fn(),
  savedMetric: {
    id: 64,
    metric_name: 'count',
    expression: 'COUNT(*)',
  },
  savedMetricsOptions: [
    {
      id: 64,
      metric_name: 'count',
      expression: 'COUNT(*)',
    },
    {
      id: 65,
      metric_name: 'sum',
      expression: 'sum(num)',
    },
  ],
  adhocMetric: new AdhocMetric({}),
  datasource: {
    extra: '{}',
    type: 'table',
  },
  columns: [
    {
      id: 1342,
      column_name: 'highest_degree_earned',
      expression:
        "CASE \n  WHEN school_degree = 'no high school (secondary school)' THEN 'A. No high school (secondary school)'\n  WHEN school_degree =  'some high school' THEN 'B. Some high school'\n  WHEN school_degree = 'high school diploma or equivalent (GED)' THEN 'C. High school diploma or equivalent (GED)'\n  WHEN school_degree = 'associate''s degree' THEN 'D. Associate''s degree'\n  WHEN school_degree = 'some college credit, no degree' THEN 'E. Some college credit, no degree'\n  WHEN school_degree = 'bachelor''s degree' THEN 'F. Bachelor''s degree'\n  WHEN school_degree = 'trade, technical, or vocational training' THEN 'G. Trade, technical, or vocational training'\n  WHEN school_degree = 'master''s degree (non-professional)' THEN 'H. Master''s degree (non-professional)'\n  WHEN school_degree = 'Ph.D.' THEN 'I. Ph.D.'\n  WHEN school_degree = 'professional degree (MBA, MD, JD, etc.)' THEN 'J. Professional degree (MBA, MD, JD, etc.)'\nEND",
      type: 'STRING',
    },
  ],
});

test('Should render', () => {
  const props = createProps();
  render(<AdhocMetricEditPopover {...props} />);
  expect(screen.getByTestId('metrics-edit-popover')).toBeVisible();
});

test('Should render correct elements', () => {
  const props = createProps();
  render(<AdhocMetricEditPopover {...props} />);
  expect(screen.getByRole('tablist')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Resize' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
});

test('Should render correct elements for SQL', () => {
  const props = createProps();
  render(<AdhocMetricEditPopover {...props} />);
  expect(screen.getByRole('tab', { name: 'Custom SQL' })).toBeVisible();
  expect(screen.getByRole('tab', { name: 'Simple' })).toBeVisible();
  expect(screen.getByRole('tab', { name: 'Saved' })).toBeVisible();
  expect(screen.getByRole('tabpanel', { name: 'Saved' })).toBeVisible();
});

test('Should render correct elements for allow ad-hoc metrics', () => {
  const props = {
    ...createProps(),
    datasource: { extra: '{"disallow_adhoc_metrics": false}' },
  };
  render(<AdhocMetricEditPopover {...props} />);
  expect(screen.getByRole('tab', { name: 'Custom SQL' })).toBeEnabled();
  expect(screen.getByRole('tab', { name: 'Simple' })).toBeEnabled();
  expect(screen.getByRole('tab', { name: 'Saved' })).toBeEnabled();
  expect(screen.getByRole('tabpanel', { name: 'Saved' })).toBeVisible();
});

test('Should render correct elements for disallow ad-hoc metrics', () => {
  const props = {
    ...createProps(),
    datasource: { extra: '{"disallow_adhoc_metrics": true}' },
  };
  render(<AdhocMetricEditPopover {...props} />);
  expect(screen.getByRole('tab', { name: 'Custom SQL' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByRole('tab', { name: 'Simple' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  expect(screen.getByRole('tab', { name: 'Saved' })).toBeEnabled();
  expect(screen.getByRole('tabpanel', { name: 'Saved' })).toBeVisible();
});

test('Clicking on "Close" should call onClose', () => {
  const props = createProps();
  render(<AdhocMetricEditPopover {...props} />);
  expect(props.onClose).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(props.onClose).toBeCalledTimes(1);
});

test('Clicking on "Save" should call onChange and onClose', async () => {
  const props = createProps();
  render(<AdhocMetricEditPopover {...props} />);
  expect(props.onChange).toBeCalledTimes(0);
  expect(props.onClose).toBeCalledTimes(0);
  userEvent.click(
    screen.getByRole('combobox', {
      name: 'Select saved metrics',
    }),
  );
  await selectOption('sum');
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(props.onChange).toBeCalledTimes(1);
  expect(props.onClose).toBeCalledTimes(1);
});

test('Clicking on "Save" should not call onChange and onClose', () => {
  const props = createProps();
  render(<AdhocMetricEditPopover {...props} />);
  expect(props.onChange).toBeCalledTimes(0);
  expect(props.onClose).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(props.onChange).toBeCalledTimes(0);
  expect(props.onClose).toBeCalledTimes(0);
});

test('Clicking on "Save" should call onChange and onClose for new metric', () => {
  const props = createProps();
  render(<AdhocMetricEditPopover {...props} isNewMetric />);
  expect(props.onChange).toBeCalledTimes(0);
  expect(props.onClose).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(props.onChange).toBeCalledTimes(1);
  expect(props.onClose).toBeCalledTimes(1);
});

test('Clicking on "Save" should call onChange and onClose for new title', () => {
  const props = createProps();
  render(<AdhocMetricEditPopover {...props} isLabelModified />);
  expect(props.onChange).toBeCalledTimes(0);
  expect(props.onClose).toBeCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(props.onChange).toBeCalledTimes(1);
  expect(props.onClose).toBeCalledTimes(1);
});

test('Should switch to tab:Simple', () => {
  const props = createProps();
  props.getCurrentTab.mockImplementation(tab => {
    props.adhocMetric.expressionType = tab;
  });
  render(<AdhocMetricEditPopover {...props} />);

  expect(screen.getByRole('tabpanel', { name: 'Saved' })).toBeVisible();
  expect(
    screen.queryByRole('tabpanel', { name: 'Simple' }),
  ).not.toBeInTheDocument();

  expect(props.getCurrentTab).toBeCalledTimes(1);
  const tab = screen.getByRole('tab', { name: 'Simple' }).parentElement!;
  userEvent.click(tab);

  expect(props.getCurrentTab).toBeCalledTimes(2);

  expect(
    screen.queryByRole('tabpanel', { name: 'Saved' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('tabpanel', { name: 'Simple' })).toBeInTheDocument();
});

test('Should render "Simple" tab correctly', () => {
  const props = createProps();
  props.getCurrentTab.mockImplementation(tab => {
    props.adhocMetric.expressionType = tab;
  });
  render(<AdhocMetricEditPopover {...props} />);

  const tab = screen.getByRole('tab', { name: 'Simple' }).parentElement!;
  userEvent.click(tab);

  expect(screen.getByText('column')).toBeVisible();
  expect(screen.getByText('aggregate')).toBeVisible();
});

test('Should switch to tab:Custom SQL', () => {
  const props = createProps();
  props.getCurrentTab.mockImplementation(tab => {
    props.adhocMetric.expressionType = tab;
  });
  render(<AdhocMetricEditPopover {...props} />);

  expect(screen.getByRole('tabpanel', { name: 'Saved' })).toBeVisible();
  expect(
    screen.queryByRole('tabpanel', { name: 'Custom SQL' }),
  ).not.toBeInTheDocument();

  expect(props.getCurrentTab).toBeCalledTimes(1);
  const tab = screen.getByRole('tab', { name: 'Custom SQL' }).parentElement!;
  userEvent.click(tab);

  expect(props.getCurrentTab).toBeCalledTimes(2);

  expect(
    screen.queryByRole('tabpanel', { name: 'Saved' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('tabpanel', { name: 'Custom SQL' }),
  ).toBeInTheDocument();
});

test('Should render "Custom SQL" tab correctly', async () => {
  const props = createProps();
  props.getCurrentTab.mockImplementation(tab => {
    props.adhocMetric.expressionType = tab;
  });
  render(<AdhocMetricEditPopover {...props} />);

  const tab = screen.getByRole('tab', { name: 'Custom SQL' }).parentElement!;
  userEvent.click(tab);

  expect(await screen.findByRole('textbox')).toBeInTheDocument();
});
