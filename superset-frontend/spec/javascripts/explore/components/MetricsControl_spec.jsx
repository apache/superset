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

import MetricsControl from '../../../../src/explore/components/controls/MetricsControl';
import { AGGREGATES } from '../../../../src/explore/constants';
import OnPasteSelect from '../../../../src/components/OnPasteSelect';
import AdhocMetric, {
  EXPRESSION_TYPES,
} from '../../../../src/explore/AdhocMetric';

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
    ...defaultProps,
    ...overrides,
  };
  const wrapper = shallow(<MetricsControl {...props} />);
  return { wrapper, onChange };
}

const valueColumn = { type: 'DOUBLE', column_name: 'value' };

const sumValueAdhocMetric = new AdhocMetric({
  column: valueColumn,
  aggregate: AGGREGATES.SUM,
  label: 'SUM(value)',
});

describe('MetricsControl', () => {
  it('renders an OnPasteSelect', () => {
    const { wrapper } = setup();
    expect(wrapper.find(OnPasteSelect)).toHaveLength(1);
  });

  describe('constructor', () => {
    it('unifies options for the dropdown select with aggregates', () => {
      const { wrapper } = setup();
      expect(wrapper.state('options')).toEqual([
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
          optionName: '_aggregate_' + aggregate,
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
      const { wrapper } = setup({ columns: [] });
      expect(wrapper.state('options')).toEqual([
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
      const { wrapper } = setup({
        value: [
          {
            expressionType: EXPRESSION_TYPES.SIMPLE,
            column: { type: 'double', column_name: 'value' },
            aggregate: AGGREGATES.SUM,
            label: 'SUM(value)',
            optionName: 'blahblahblah',
          },
          'avg__value',
        ],
      });

      const adhocMetric = wrapper.state('value')[0];
      expect(adhocMetric instanceof AdhocMetric).toBe(true);
      expect(adhocMetric.optionName.length).toBeGreaterThan(10);
      expect(wrapper.state('value')).toEqual([
        {
          expressionType: EXPRESSION_TYPES.SIMPLE,
          column: { type: 'double', column_name: 'value' },
          aggregate: AGGREGATES.SUM,
          fromFormData: true,
          label: 'SUM(value)',
          hasCustomLabel: false,
          optionName: 'blahblahblah',
          sqlExpression: null,
        },
        'avg__value',
      ]);
    });
  });

  describe('onChange', () => {
    it('handles saved metrics being selected', () => {
      const { wrapper, onChange } = setup();
      const select = wrapper.find(OnPasteSelect);
      select.simulate('change', [{ metric_name: 'sum__value' }]);
      expect(onChange.lastCall.args).toEqual([['sum__value']]);
    });

    it('handles columns being selected', () => {
      const { wrapper, onChange } = setup();
      const select = wrapper.find(OnPasteSelect);
      select.simulate('change', [valueColumn]);

      const adhocMetric = onChange.lastCall.args[0][0];
      expect(adhocMetric instanceof AdhocMetric).toBe(true);
      expect(onChange.lastCall.args).toEqual([
        [
          {
            expressionType: EXPRESSION_TYPES.SIMPLE,
            column: valueColumn,
            aggregate: AGGREGATES.SUM,
            label: 'SUM(value)',
            fromFormData: false,
            hasCustomLabel: false,
            optionName: adhocMetric.optionName,
            sqlExpression: null,
          },
        ],
      ]);
    });

    it('handles aggregates being selected', () => {
      const { wrapper, onChange } = setup();
      const select = wrapper.find(OnPasteSelect);

      // mock out the Select ref
      const setInputSpy = sinon.spy();
      const handleInputSpy = sinon.spy();
      wrapper.instance().select = {
        setInputValue: setInputSpy,
        handleInputChange: handleInputSpy,
        input: { input: {} },
      };

      select.simulate('change', [{ aggregate_name: 'SUM', optionName: 'SUM' }]);

      expect(setInputSpy.calledWith('SUM()')).toBe(true);
      expect(handleInputSpy.calledWith({ target: { value: 'SUM()' } })).toBe(
        true,
      );
      expect(onChange.lastCall.args).toEqual([[]]);
    });

    it('preserves existing selected AdhocMetrics', () => {
      const { wrapper, onChange } = setup();
      const select = wrapper.find(OnPasteSelect);
      select.simulate('change', [
        { metric_name: 'sum__value' },
        sumValueAdhocMetric,
      ]);
      expect(onChange.lastCall.args).toEqual([
        ['sum__value', sumValueAdhocMetric],
      ]);
    });
  });

  describe('onMetricEdit', () => {
    it('accepts an edited metric from an AdhocMetricEditPopover', () => {
      const { wrapper, onChange } = setup({
        value: [sumValueAdhocMetric],
      });

      const editedMetric = sumValueAdhocMetric.duplicateWith({
        aggregate: AGGREGATES.AVG,
      });
      wrapper.instance().onMetricEdit(editedMetric);

      expect(onChange.lastCall.args).toEqual([[editedMetric]]);
    });
  });

  describe('checkIfAggregateInInput', () => {
    it('handles an aggregate in the input', () => {
      const { wrapper } = setup();

      expect(wrapper.state('aggregateInInput')).toBeNull();
      wrapper.instance().checkIfAggregateInInput('AVG(');
      expect(wrapper.state('aggregateInInput')).toBe(AGGREGATES.AVG);
    });

    it('handles no aggregate in the input', () => {
      const { wrapper } = setup();

      expect(wrapper.state('aggregateInInput')).toBeNull();
      wrapper.instance().checkIfAggregateInInput('colu');
      expect(wrapper.state('aggregateInInput')).toBeNull();
    });
  });

  describe('option filter', () => {
    it('includes user defined metrics', () => {
      const { wrapper } = setup({ datasourceType: 'druid' });

      expect(
        !!wrapper.instance().selectFilterOption(
          {
            metric_name: 'a_metric',
            optionName: 'a_metric',
            expression: 'SUM(FANCY(metric))',
          },
          'a',
        ),
      ).toBe(true);
    });

    it('includes auto generated avg metrics for druid', () => {
      const { wrapper } = setup({ datasourceType: 'druid' });

      expect(
        !!wrapper.instance().selectFilterOption(
          {
            metric_name: 'avg__metric',
            optionName: 'avg__metric',
            expression: 'AVG(metric)',
          },
          'a',
        ),
      ).toBe(true);
    });

    it('includes columns and aggregates', () => {
      const { wrapper } = setup();

      expect(
        !!wrapper.instance().selectFilterOption(
          {
            type: 'VARCHAR(255)',
            column_name: 'source',
            optionName: '_col_source',
          },
          'sou',
        ),
      ).toBe(true);

      expect(
        !!wrapper
          .instance()
          .selectFilterOption(
            { aggregate_name: 'AVG', optionName: '_aggregate_AVG' },
            'av',
          ),
      ).toBe(true);
    });

    it('includes columns based on verbose_name', () => {
      const { wrapper } = setup();

      expect(
        !!wrapper.instance().selectFilterOption(
          {
            metric_name: 'sum__num',
            verbose_name: 'babies',
            optionName: '_col_sum_num',
          },
          'bab',
        ),
      ).toBe(true);
    });

    it('excludes auto generated avg metrics for sqla', () => {
      const { wrapper } = setup();

      expect(
        !!wrapper.instance().selectFilterOption(
          {
            metric_name: 'avg__metric',
            optionName: 'avg__metric',
            expression: 'AVG(metric)',
          },
          'a',
        ),
      ).toBe(false);
    });

    it('includes custom made simple saved metrics', () => {
      const { wrapper } = setup();

      expect(
        !!wrapper.instance().selectFilterOption(
          {
            metric_name: 'my_fancy_sum_metric',
            optionName: 'my_fancy_sum_metric',
            expression: 'SUM(value)',
          },
          'sum',
        ),
      ).toBe(true);
    });

    it('excludes auto generated metrics', () => {
      const { wrapper } = setup();

      expect(
        !!wrapper.instance().selectFilterOption(
          {
            metric_name: 'sum__value',
            optionName: 'sum__value',
            expression: 'SUM(value)',
          },
          'sum',
        ),
      ).toBe(false);

      expect(
        !!wrapper.instance().selectFilterOption(
          {
            metric_name: 'sum__value',
            optionName: 'sum__value',
            expression: 'SUM("table"."value")',
          },
          'sum',
        ),
      ).toBe(false);
    });

    it('filters out metrics if the input begins with an aggregate', () => {
      const { wrapper } = setup();
      wrapper.setState({ aggregateInInput: true });

      expect(
        !!wrapper
          .instance()
          .selectFilterOption(
            { metric_name: 'metric', expression: 'SUM(FANCY(metric))' },
            'SUM(',
          ),
      ).toBe(false);
    });

    it('includes columns if the input begins with an aggregate', () => {
      const { wrapper } = setup();
      wrapper.setState({ aggregateInInput: true });

      expect(
        !!wrapper
          .instance()
          .selectFilterOption({ type: 'DOUBLE', column_name: 'value' }, 'SUM('),
      ).toBe(true);
    });

    it('Removes metrics if savedMetrics changes', () => {
      const { props, wrapper, onChange } = setup({
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
      expect(wrapper.state('value')).toHaveLength(1);

      wrapper.setProps({ ...props, columns: [] });
      expect(onChange.lastCall.args).toEqual([[]]);
    });

    it('Does not remove custom sql metric if savedMetrics changes', () => {
      const { props, wrapper, onChange } = setup({
        value: [
          {
            expressionType: EXPRESSION_TYPES.SQL,
            sqlExpression: 'COUNT(*)',
            label: 'old label',
            hasCustomLabel: true,
          },
        ],
      });
      expect(wrapper.state('value')).toHaveLength(1);

      wrapper.setProps({ ...props, columns: [] });
      expect(onChange.calledOnce).toEqual(false);
    });
    it('Does not fail if no columns or savedMetrics are passed', () => {
      const { wrapper } = setup({
        savedMetrics: null,
        columns: null,
      });
      expect(wrapper.exists('.metrics-select')).toEqual(true);
    });
  });
});
