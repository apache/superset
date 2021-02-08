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
/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';

import { AGGREGATES } from 'src/explore/constants';
import { LabelsContainer } from 'src/explore/components/OptionControls';
import { supersetTheme } from '@superset-ui/core';
import MetricsControl from 'src/explore/components/controls/MetricControl/MetricsControl';
import AdhocMetric, {
  EXPRESSION_TYPES,
} from 'src/explore/components/controls/MetricControl/AdhocMetric';

const defaultProps = {
  name: 'metrics',
  label: 'Metrics',
  value: undefined,
  multi: true,
  columns: [
    { type: 'VARCHAR(255)', column_name: 'source' },
    { type: 'VARCHAR(255)', column_name: 'target' },
    { type: 'DOUBLE', column_name: 'value' },
  ],
  savedMetrics: [
    { metric_name: 'sum__value', expression: 'SUM(energy_usage.value)' },
    { metric_name: 'avg__value', expression: 'AVG(energy_usage.value)' },
  ],
  datasourceType: 'sqla',
};

function setup(overrides) {
  const onChange = sinon.spy();
  const props = {
    onChange,
    theme: supersetTheme,
    ...defaultProps,
    ...overrides,
  };
  const wrapper = shallow(<MetricsControl {...props} />);
  const component = wrapper.dive().shallow();
  return { wrapper, component, onChange };
}

const valueColumn = { type: 'DOUBLE', column_name: 'value' };

const sumValueAdhocMetric = new AdhocMetric({
  column: valueColumn,
  aggregate: AGGREGATES.SUM,
  label: 'SUM(value)',
});

describe('MetricsControl', () => {
  it('renders Select', () => {
    const { component } = setup();
    expect(component.find(LabelsContainer)).toExist();
  });

  describe('constructor', () => {
    it('unifies options for the dropdown select with aggregates', () => {
      const { component } = setup();
      expect(component.state('options')).toEqual([
        {
          optionName: '_col_source',
          type: 'VARCHAR(255)',
          column_name: 'source',
        },
        {
          optionName: '_col_target',
          type: 'VARCHAR(255)',
          column_name: 'target',
        },
        { optionName: '_col_value', type: 'DOUBLE', column_name: 'value' },
        ...Object.keys(AGGREGATES).map(aggregate => ({
          aggregate_name: aggregate,
          optionName: `_aggregate_${aggregate}`,
        })),
        {
          optionName: 'sum__value',
          metric_name: 'sum__value',
          expression: 'SUM(energy_usage.value)',
        },
        {
          optionName: 'avg__value',
          metric_name: 'avg__value',
          expression: 'AVG(energy_usage.value)',
        },
      ]);
    });

    it('does not show aggregates in options if no columns', () => {
      const { component } = setup({ columns: [] });
      expect(component.state('options')).toEqual([
        {
          optionName: 'sum__value',
          metric_name: 'sum__value',
          expression: 'SUM(energy_usage.value)',
        },
        {
          optionName: 'avg__value',
          metric_name: 'avg__value',
          expression: 'AVG(energy_usage.value)',
        },
      ]);
    });

    it('coerces Adhoc Metrics from form data into instances of the AdhocMetric class and leaves saved metrics', () => {
      const { component } = setup({
        value: [
          {
            expressionType: EXPRESSION_TYPES.SIMPLE,
            column: { type: 'double', column_name: 'value' },
            aggregate: AGGREGATES.SUM,
            label: 'SUM(value)',
            optionName: 'blahblahblah',
          },
        ],
      });

      const adhocMetric = component.state('value')[0];
      expect(adhocMetric instanceof AdhocMetric).toBe(true);
      expect(adhocMetric.optionName.length).toBeGreaterThan(10);
      expect(component.state('value')).toEqual([
        {
          expressionType: EXPRESSION_TYPES.SIMPLE,
          column: { type: 'double', column_name: 'value' },
          aggregate: AGGREGATES.SUM,
          label: 'SUM(value)',
          hasCustomLabel: false,
          optionName: 'blahblahblah',
          sqlExpression: null,
          isNew: false,
        },
      ]);
    });
  });

  describe('onChange', () => {
    it('handles creating a new metric', () => {
      const { component, onChange } = setup();
      component.instance().onNewMetric({
        metric_name: 'sum__value',
        expression: 'SUM(energy_usage.value)',
      });
      expect(onChange.lastCall.args).toEqual([['sum__value']]);
    });
  });

  describe('onMetricEdit', () => {
    it('accepts an edited metric from an AdhocMetricEditPopover', () => {
      const { component, onChange } = setup({
        value: [sumValueAdhocMetric],
      });

      const editedMetric = sumValueAdhocMetric.duplicateWith({
        aggregate: AGGREGATES.AVG,
      });
      component.instance().onMetricEdit(editedMetric, sumValueAdhocMetric);

      expect(onChange.lastCall.args).toEqual([[editedMetric]]);
    });
  });

  describe('checkIfAggregateInInput', () => {
    it('handles an aggregate in the input', () => {
      const { component } = setup();

      expect(component.state('aggregateInInput')).toBeNull();
      component.instance().checkIfAggregateInInput('AVG(');
      expect(component.state('aggregateInInput')).toBe(AGGREGATES.AVG);
    });

    it('handles no aggregate in the input', () => {
      const { component } = setup();

      expect(component.state('aggregateInInput')).toBeNull();
      component.instance().checkIfAggregateInInput('colu');
      expect(component.state('aggregateInInput')).toBeNull();
    });
  });

  describe('option filter', () => {
    it('includes user defined metrics', () => {
      const { component } = setup({ datasourceType: 'druid' });

      expect(
        !!component.instance().selectFilterOption(
          {
            data: {
              metric_name: 'a_metric',
              optionName: 'a_metric',
              expression: 'SUM(FANCY(metric))',
            },
          },
          'a',
        ),
      ).toBe(true);
    });

    it('includes auto generated avg metrics for druid', () => {
      const { component } = setup({ datasourceType: 'druid' });

      expect(
        !!component.instance().selectFilterOption(
          {
            data: {
              metric_name: 'avg__metric',
              optionName: 'avg__metric',
              expression: 'AVG(metric)',
            },
          },
          'a',
        ),
      ).toBe(true);
    });

    it('includes columns and aggregates', () => {
      const { component } = setup();

      expect(
        !!component.instance().selectFilterOption(
          {
            data: {
              type: 'VARCHAR(255)',
              column_name: 'source',
              optionName: '_col_source',
            },
          },
          'sou',
        ),
      ).toBe(true);

      expect(
        !!component
          .instance()
          .selectFilterOption(
            { data: { aggregate_name: 'AVG', optionName: '_aggregate_AVG' } },
            'av',
          ),
      ).toBe(true);
    });

    it('includes columns based on verbose_name', () => {
      const { component } = setup();

      expect(
        !!component.instance().selectFilterOption(
          {
            data: {
              metric_name: 'sum__num',
              verbose_name: 'babies',
              optionName: '_col_sum_num',
            },
          },
          'bab',
        ),
      ).toBe(true);
    });

    it('excludes auto generated avg metrics for sqla', () => {
      const { component } = setup();

      expect(
        !!component.instance().selectFilterOption(
          {
            data: {
              metric_name: 'avg__metric',
              optionName: 'avg__metric',
              expression: 'AVG(metric)',
            },
          },
          'a',
        ),
      ).toBe(false);
    });

    it('includes custom made simple saved metrics', () => {
      const { component } = setup();

      expect(
        !!component.instance().selectFilterOption(
          {
            data: {
              metric_name: 'my_fancy_sum_metric',
              optionName: 'my_fancy_sum_metric',
              expression: 'SUM(value)',
            },
          },
          'sum',
        ),
      ).toBe(true);
    });

    it('excludes auto generated metrics', () => {
      const { component } = setup();

      expect(
        !!component.instance().selectFilterOption(
          {
            data: {
              metric_name: 'sum__value',
              optionName: 'sum__value',
              expression: 'SUM(value)',
            },
          },
          'sum',
        ),
      ).toBe(false);

      expect(
        !!component.instance().selectFilterOption(
          {
            data: {
              metric_name: 'sum__value',
              optionName: 'sum__value',
              expression: 'SUM("table"."value")',
            },
          },
          'sum',
        ),
      ).toBe(false);
    });

    it('filters out metrics if the input begins with an aggregate', () => {
      const { component } = setup();
      component.setState({ aggregateInInput: true });

      expect(
        !!component.instance().selectFilterOption(
          {
            data: { metric_name: 'metric', expression: 'SUM(FANCY(metric))' },
          },
          'SUM(',
        ),
      ).toBe(false);
    });

    it('includes columns if the input begins with an aggregate', () => {
      const { component } = setup();
      component.setState({ aggregateInInput: true });

      expect(
        !!component
          .instance()
          .selectFilterOption(
            { data: { type: 'DOUBLE', column_name: 'value' } },
            'SUM(',
          ),
      ).toBe(true);
    });

    it('Removes metrics if savedMetrics changes', () => {
      const { props, component, onChange } = setup({
        value: [
          {
            expressionType: EXPRESSION_TYPES.SIMPLE,
            column: { type: 'double', column_name: 'value' },
            aggregate: AGGREGATES.SUM,
            label: 'SUM(value)',
            optionName: 'blahblahblah',
          },
        ],
      });
      expect(component.state('value')).toHaveLength(1);

      component.setProps({ ...props, columns: [] });
      expect(onChange.lastCall.args).toEqual([[]]);
    });

    it('Does not remove custom sql metric if savedMetrics changes', () => {
      const { props, component, onChange } = setup({
        value: [
          {
            expressionType: EXPRESSION_TYPES.SQL,
            sqlExpression: 'COUNT(*)',
            label: 'old label',
            hasCustomLabel: true,
          },
        ],
      });
      expect(component.state('value')).toHaveLength(1);

      component.setProps({ ...props, columns: [] });
      expect(onChange.calledOnce).toEqual(false);
    });
    it('Does not fail if no columns or savedMetrics are passed', () => {
      const { component } = setup({
        savedMetrics: null,
        columns: null,
      });
      expect(component.exists('.metrics-select')).toEqual(true);
    });
  });
});
