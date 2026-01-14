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
import {
  render,
  screen,
  selectOption,
  userEvent,
} from 'spec/helpers/testing-library';
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
  expect(props.onClose).toHaveBeenCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('Clicking on "Save" should call onChange and onClose', async () => {
  const props = createProps();
  render(<AdhocMetricEditPopover {...props} />);
  expect(props.onChange).toHaveBeenCalledTimes(0);
  expect(props.onClose).toHaveBeenCalledTimes(0);
  userEvent.click(
    screen.getByRole('combobox', {
      name: 'Select saved metrics',
    }),
  );
  await selectOption('sum');
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(props.onChange).toHaveBeenCalledTimes(1);
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('Clicking on "Save" should not call onChange and onClose', () => {
  const props = createProps();
  render(<AdhocMetricEditPopover {...props} />);
  expect(props.onChange).toHaveBeenCalledTimes(0);
  expect(props.onClose).toHaveBeenCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(props.onChange).toHaveBeenCalledTimes(0);
  expect(props.onClose).toHaveBeenCalledTimes(0);
});

test('Clicking on "Save" should call onChange and onClose for new metric', () => {
  const props = createProps();
  render(<AdhocMetricEditPopover {...props} isNewMetric />);
  expect(props.onChange).toHaveBeenCalledTimes(0);
  expect(props.onClose).toHaveBeenCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(props.onChange).toHaveBeenCalledTimes(1);
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('Clicking on "Save" should call onChange and onClose for new title', () => {
  const props = createProps();
  render(<AdhocMetricEditPopover {...props} isLabelModified />);
  expect(props.onChange).toHaveBeenCalledTimes(0);
  expect(props.onClose).toHaveBeenCalledTimes(0);
  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(props.onChange).toHaveBeenCalledTimes(1);
  expect(props.onClose).toHaveBeenCalledTimes(1);
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

  expect(props.getCurrentTab).toHaveBeenCalledTimes(1);
  const tab = screen.getByRole('tab', { name: 'Simple' }).parentElement!;
  userEvent.click(tab);

  expect(props.getCurrentTab).toHaveBeenCalledTimes(2);

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

  expect(props.getCurrentTab).toHaveBeenCalledTimes(1);
  const tab = screen.getByRole('tab', { name: 'Custom SQL' }).parentElement!;
  userEvent.click(tab);

  expect(props.getCurrentTab).toHaveBeenCalledTimes(2);

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

test('Should filter saved metrics by metric_name', async () => {
  const props = {
    ...createProps(),
    savedMetricsOptions: [
      {
        id: 64,
        metric_name: 'count',
        expression: 'COUNT(*)',
        verbose_name: 'Total Count',
      },
      {
        id: 65,
        metric_name: 'revenue_sum',
        expression: 'sum(revenue)',
        verbose_name: 'Total Sales Amount',
      },
    ],
  };
  render(<AdhocMetricEditPopover {...props} />);

  const combobox = screen.getByRole('combobox', {
    name: 'Select saved metrics',
  });
  userEvent.click(combobox);

  // Search by metric_name - 'revenue' is only in metric_name, not in verbose_name
  await userEvent.type(combobox, 'revenue');

  await selectOption('Total Sales Amount', 'Select saved metrics');

  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(props.onChange).toHaveBeenCalledTimes(1);
  expect(props.onChange).toHaveBeenCalledWith(
    expect.objectContaining({ metric_name: 'revenue_sum' }),
    expect.anything(),
  );
});

test('Should filter saved metrics by verbose_name', async () => {
  const props = {
    ...createProps(),
    savedMetricsOptions: [
      {
        id: 64,
        metric_name: 'count',
        expression: 'COUNT(*)',
        verbose_name: 'Total Count',
      },
      {
        id: 65,
        metric_name: 'revenue_sum',
        expression: 'sum(revenue)',
        verbose_name: 'Total Sales Amount',
      },
    ],
  };
  render(<AdhocMetricEditPopover {...props} />);

  const combobox = screen.getByRole('combobox', {
    name: 'Select saved metrics',
  });
  userEvent.click(combobox);

  // Search by verbose_name - 'Sales' is only in verbose_name, not in metric_name
  await userEvent.type(combobox, 'Sales');

  await selectOption('Total Sales Amount', 'Select saved metrics');

  userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(props.onChange).toHaveBeenCalledTimes(1);
  expect(props.onChange).toHaveBeenCalledWith(
    expect.objectContaining({ metric_name: 'revenue_sum' }),
    expect.anything(),
  );
});

test('Should filter columns by column_name in Simple tab', async () => {
  const props = {
    ...createProps(),
    columns: [
      {
        id: 1,
        column_name: 'user_id',
        verbose_name: 'User Identifier',
        type: 'INTEGER',
      },
      {
        id: 2,
        column_name: 'created_at',
        verbose_name: 'Creation Timestamp',
        type: 'DATETIME',
      },
    ],
  };
  props.getCurrentTab.mockImplementation(tab => {
    props.adhocMetric.expressionType = tab;
  });
  render(<AdhocMetricEditPopover {...props} />);

  const tab = screen.getByRole('tab', { name: 'Simple' }).parentElement!;
  userEvent.click(tab);

  const columnCombobox = screen.getByRole('combobox', {
    name: 'Select column',
  });

  // Search by column_name - 'created' is only in column_name, not in verbose_name
  await userEvent.type(columnCombobox, 'created');

  await selectOption('Creation Timestamp', 'Select column');

  expect(props.onChange).toHaveBeenCalledTimes(0);
});

test('Should filter columns by verbose_name in Simple tab', async () => {
  const props = {
    ...createProps(),
    columns: [
      {
        id: 1,
        column_name: 'user_id',
        verbose_name: 'User Identifier',
        type: 'INTEGER',
      },
      {
        id: 2,
        column_name: 'created_at',
        verbose_name: 'Creation Timestamp',
        type: 'DATETIME',
      },
    ],
  };
  props.getCurrentTab.mockImplementation(tab => {
    props.adhocMetric.expressionType = tab;
  });
  render(<AdhocMetricEditPopover {...props} />);

  const tab = screen.getByRole('tab', { name: 'Simple' }).parentElement!;
  userEvent.click(tab);

  const columnCombobox = screen.getByRole('combobox', {
    name: 'Select column',
  });

  // Search by verbose_name - 'Timestamp' is only in verbose_name, not in column_name
  await userEvent.type(columnCombobox, 'Timestamp');

  await selectOption('Creation Timestamp', 'Select column');

  expect(props.onChange).toHaveBeenCalledTimes(0);
});
