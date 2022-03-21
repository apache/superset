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
import { LabelsContainer } from 'src/explore/components/controls/OptionControls';
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
  const component = wrapper.shallow();
  return { wrapper, component, onChange };
}

const valueColumn = { type: 'DOUBLE', column_name: 'value' };

const sumValueAdhocMetric = new AdhocMetric({
  column: valueColumn,
  aggregate: AGGREGATES.SUM,
  label: 'SUM(value)',
});

// TODO: rewrite the tests to RTL
describe.skip('MetricsControl', () => {
  it('renders Select', () => {
    const { component } = setup();
    expect(component.find(LabelsContainer)).toExist();
  });

  describe('constructor', () => {
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

  describe('option filter', () => {
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
