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
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { isFeatureEnabled } from '@superset-ui/core';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import AdhocMetricEditPopover from '.';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(() => false),
}));

jest.mock('@superset-ui/core/connection', () => ({
  SupersetClient: {
    get: jest.fn(() =>
      Promise.resolve({
        json: {
          result: {
            locales: [
              { code: 'de', name: 'Deutsch', flag: '\ud83c\udde9\ud83c\uddea' },
              { code: 'fr', name: 'Fran\u00e7ais', flag: '\ud83c\uddeb\ud83c\uddf7' },
            ],
            default_locale: 'en',
          },
        },
      }),
    ),
  },
}));

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

test('Should filter saved metrics by metric_name and verbose_name', async () => {
  const props = {
    ...createProps(),
    savedMetricsOptions: [
      {
        id: 1,
        metric_name: 'count',
        expression: 'COUNT(*)',
        verbose_name: 'Total Count',
      },
      {
        id: 2,
        metric_name: 'revenue_sum',
        expression: 'sum(revenue)',
        verbose_name: 'Gross Revenue',
      },
      {
        id: 3,
        metric_name: 'avg_price',
        expression: 'AVG(price)',
        verbose_name: 'Average Price',
      },
      {
        id: 4,
        metric_name: 'user_count',
        expression: 'COUNT(DISTINCT user_id)',
        verbose_name: 'Unique Users',
      },
      {
        id: 5,
        metric_name: 'total_quantity',
        expression: 'SUM(quantity)',
        verbose_name: 'Total Quantity',
      },
    ],
  };
  render(<AdhocMetricEditPopover {...props} />);

  const combobox = screen.getByRole('combobox', {
    name: 'Select saved metrics',
  });
  userEvent.click(combobox);

  await userEvent.type(combobox, 'revenue');

  let dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('Gross Revenue')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Total Count')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Average Price')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Unique Users')).not.toBeInTheDocument();
  expect(
    within(dropdown).queryByText('Total Quantity'),
  ).not.toBeInTheDocument();

  await userEvent.clear(combobox);
  await userEvent.type(combobox, 'Unique');

  dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('Unique Users')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Total Count')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Gross Revenue')).not.toBeInTheDocument();

  await userEvent.clear(combobox);
  await userEvent.type(combobox, 'total');

  dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('Total Count')).toBeInTheDocument();
  expect(within(dropdown).getByText('Total Quantity')).toBeInTheDocument();
  expect(within(dropdown).queryByText('Gross Revenue')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Average Price')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Unique Users')).not.toBeInTheDocument();
});

test('Should filter columns by column_name and verbose_name in Simple tab', async () => {
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
      {
        id: 3,
        column_name: 'order_total',
        verbose_name: 'Order Amount',
        type: 'DECIMAL',
      },
      {
        id: 4,
        column_name: 'product_name',
        verbose_name: 'Product Title',
        type: 'STRING',
      },
      {
        id: 5,
        column_name: 'updated_at',
        verbose_name: 'Last Modified',
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

  await userEvent.type(columnCombobox, 'product');

  let dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('Product Title')).toBeInTheDocument();
  expect(
    within(dropdown).queryByText('User Identifier'),
  ).not.toBeInTheDocument();
  expect(
    within(dropdown).queryByText('Creation Timestamp'),
  ).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Order Amount')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Last Modified')).not.toBeInTheDocument();

  await userEvent.clear(columnCombobox);
  await userEvent.type(columnCombobox, 'Modified');

  dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('Last Modified')).toBeInTheDocument();
  expect(
    within(dropdown).queryByText('User Identifier'),
  ).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Product Title')).not.toBeInTheDocument();

  await userEvent.clear(columnCombobox);
  await userEvent.type(columnCombobox, '_at');

  dropdown = document.querySelector('.rc-virtual-list') as HTMLElement;
  expect(within(dropdown).getByText('Creation Timestamp')).toBeInTheDocument();
  expect(within(dropdown).getByText('Last Modified')).toBeInTheDocument();
  expect(
    within(dropdown).queryByText('User Identifier'),
  ).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Order Amount')).not.toBeInTheDocument();
  expect(within(dropdown).queryByText('Product Title')).not.toBeInTheDocument();
});

test('Should not render MetricLabelTranslations when localization disabled', () => {
  const props = createProps();
  render(
    <AdhocMetricEditPopover
      {...props}
      hasCustomLabel
      currentLabel="My Metric"
      translations={{}}
      onTranslationsChange={jest.fn()}
    />,
    { useRedux: true, initialState: { common: { locale: 'en' } } },
  );
  expect(
    screen.queryByTestId('MetricLabelTranslations'),
  ).not.toBeInTheDocument();
});

test('Should not render MetricLabelTranslations without custom label', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  const props = createProps();
  render(
    <AdhocMetricEditPopover
      {...props}
      hasCustomLabel={false}
      currentLabel="COUNT(*)"
      translations={{}}
      onTranslationsChange={jest.fn()}
    />,
    { useRedux: true, initialState: { common: { locale: 'en' } } },
  );
  await waitFor(() => {
    expect(
      screen.queryByTestId('MetricLabelTranslations'),
    ).not.toBeInTheDocument();
  });
  (isFeatureEnabled as jest.Mock).mockReturnValue(false);
});

test('Should render MetricLabelTranslations when localization enabled and custom label', async () => {
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  const props = createProps();
  render(
    <AdhocMetricEditPopover
      {...props}
      hasCustomLabel
      currentLabel="Total Revenue"
      translations={{ label: { de: 'Gesamtumsatz' } }}
      onTranslationsChange={jest.fn()}
    />,
    { useRedux: true, initialState: { common: { locale: 'en' } } },
  );
  expect(
    await screen.findByTestId('MetricLabelTranslations'),
  ).toBeInTheDocument();
  (isFeatureEnabled as jest.Mock).mockReturnValue(false);
});

test('Should enable Save when translations changed', () => {
  const props = createProps();
  render(
    <AdhocMetricEditPopover
      {...props}
      hasTranslationChanges
      translations={{ label: { de: 'Neu' } }}
      onTranslationsChange={jest.fn()}
    />,
  );
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});
