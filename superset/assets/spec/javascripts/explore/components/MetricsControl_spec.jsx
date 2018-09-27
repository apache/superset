/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { shallow } from 'enzyme';

import MetricsControl from '../../../../src/explore/components/controls/MetricsControl';
import { AGGREGATES } from '../../../../src/explore/constants';
import OnPasteSelect from '../../../../src/components/OnPasteSelect';
import AdhocMetric, { EXPRESSION_TYPES } from '../../../../src/explore/AdhocMetric';

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
    expect(wrapper.find(OnPasteSelect)).to.have.lengthOf(1);
  });

  describe('constructor', () => {

    it('unifies options for the dropdown select with aggregates', () => {
      const { wrapper } = setup();
      expect(wrapper.state('options')).to.deep.equal([
        { optionName: '_col_source', type: 'VARCHAR(255)', column_name: 'source' },
        { optionName: '_col_target', type: 'VARCHAR(255)', column_name: 'target' },
        { optionName: '_col_value', type: 'DOUBLE', column_name: 'value' },
        ...Object.keys(AGGREGATES).map(
          aggregate => ({ aggregate_name: aggregate, optionName: '_aggregate_' + aggregate }),
        ),
        { optionName: 'sum__value', metric_name: 'sum__value', expression: 'SUM(energy_usage.value)' },
        { optionName: 'avg__value', metric_name: 'avg__value', expression: 'AVG(energy_usage.value)' },
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
      expect(adhocMetric instanceof AdhocMetric).to.be.true;
      expect(adhocMetric.optionName.length).to.be.above(10);
      expect(wrapper.state('value')).to.deep.equal([
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
      expect(onChange.lastCall.args).to.deep.equal([['sum__value']]);
    });

    it('handles columns being selected', () => {
      const { wrapper, onChange } = setup();
      const select = wrapper.find(OnPasteSelect);
      select.simulate('change', [valueColumn]);

      const adhocMetric = onChange.lastCall.args[0][0];
      expect(adhocMetric instanceof AdhocMetric).to.be.true;
      expect(onChange.lastCall.args).to.deep.equal([[{
        expressionType: EXPRESSION_TYPES.SIMPLE,
        column: valueColumn,
        aggregate: AGGREGATES.SUM,
        label: 'SUM(value)',
        fromFormData: false,
        hasCustomLabel: false,
        optionName: adhocMetric.optionName,
        sqlExpression: null,
      }]]);
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

      expect(setInputSpy.calledWith('SUM()')).to.be.true;
      expect(handleInputSpy.calledWith({ target: { value: 'SUM()' } })).to.be.true;
      expect(onChange.lastCall.args).to.deep.equal([[]]);
    });

    it('preserves existing selected AdhocMetrics', () => {
      const { wrapper, onChange } = setup();
      const select = wrapper.find(OnPasteSelect);
      select.simulate('change', [{ metric_name: 'sum__value' }, sumValueAdhocMetric]);
      expect(onChange.lastCall.args).to.deep.equal([['sum__value', sumValueAdhocMetric]]);
    });
  });

  describe('onMetricEdit', () => {
    it('accepts an edited metric from an AdhocMetricEditPopover', () => {
      const { wrapper, onChange } = setup({
        value: [sumValueAdhocMetric],
      });

      const editedMetric = sumValueAdhocMetric.duplicateWith({ aggregate: AGGREGATES.AVG });
      wrapper.instance().onMetricEdit(editedMetric);

      expect(onChange.lastCall.args).to.deep.equal([[
        editedMetric,
      ]]);
    });
  });

  describe('checkIfAggregateInInput', () => {
    it('handles an aggregate in the input', () => {
      const { wrapper } = setup();

      expect(wrapper.state('aggregateInInput')).to.be.null;
      wrapper.instance().checkIfAggregateInInput('AVG(');
      expect(wrapper.state('aggregateInInput')).to.equal(AGGREGATES.AVG);
    });

    it('handles no aggregate in the input', () => {
      const { wrapper } = setup();

      expect(wrapper.state('aggregateInInput')).to.be.null;
      wrapper.instance().checkIfAggregateInInput('colu');
      expect(wrapper.state('aggregateInInput')).to.be.null;
    });
  });

  describe('option filter', () => {
    it('includes user defined metrics', () => {
      const { wrapper } = setup({ datasourceType: 'druid' });

      expect(!!wrapper.instance().selectFilterOption(
        {
          metric_name: 'a_metric',
          optionName: 'a_metric',
          expression: 'SUM(FANCY(metric))',
        },
        'a',
      )).to.be.true;
    });

    it('includes auto generated avg metrics for druid', () => {
      const { wrapper } = setup({ datasourceType: 'druid' });

      expect(!!wrapper.instance().selectFilterOption(
        {
          metric_name: 'avg__metric',
          optionName: 'avg__metric',
          expression: 'AVG(metric)',
        },
        'a',
      )).to.be.true;
    });

    it('includes columns and aggregates', () => {
      const { wrapper } = setup();

      expect(!!wrapper.instance().selectFilterOption(
        { type: 'VARCHAR(255)', column_name: 'source', optionName: '_col_source' },
        'sou',
      )).to.be.true;

      expect(!!wrapper.instance().selectFilterOption(
        { aggregate_name: 'AVG', optionName: '_aggregate_AVG' },
        'av',
      )).to.be.true;
    });

    it('includes columns based on verbose_name', () => {
      const { wrapper } = setup();

      expect(!!wrapper.instance().selectFilterOption(
        { metric_name: 'sum__num', verbose_name: 'babies', optionName: '_col_sum_num' },
        'bab',
      )).to.be.true;
    });

    it('excludes auto generated avg metrics for sqla', () => {
      const { wrapper } = setup();

      expect(!!wrapper.instance().selectFilterOption(
        {
          metric_name: 'avg__metric',
          optionName: 'avg__metric',
          expression: 'AVG(metric)',
        },
        'a',
      )).to.be.false;
    });

    it('includes custom made simple saved metrics', () => {
      const { wrapper } = setup();

      expect(!!wrapper.instance().selectFilterOption(
        {
          metric_name: 'my_fancy_sum_metric',
          optionName: 'my_fancy_sum_metric',
          expression: 'SUM(value)',
        },
        'sum',
      )).to.be.true;
    });

    it('excludes auto generated metrics', () => {
      const { wrapper } = setup();

      expect(!!wrapper.instance().selectFilterOption(
        {
          metric_name: 'sum__value',
          optionName: 'sum__value',
          expression: 'SUM(value)',
        },
        'sum',
      )).to.be.false;

      expect(!!wrapper.instance().selectFilterOption(
        {
          metric_name: 'sum__value',
          optionName: 'sum__value',
          expression: 'SUM("table"."value")',
        },
        'sum',
      )).to.be.false;
    });

    it('filters out metrics if the input begins with an aggregate', () => {
      const { wrapper } = setup();
      wrapper.setState({ aggregateInInput: true });

      expect(!!wrapper.instance().selectFilterOption(
        { metric_name: 'metric', expression: 'SUM(FANCY(metric))' },
        'SUM(',
      )).to.be.false;
    });

    it('includes columns if the input begins with an aggregate', () => {
      const { wrapper } = setup();
      wrapper.setState({ aggregateInInput: true });

      expect(!!wrapper.instance().selectFilterOption(
        { type: 'DOUBLE', column_name: 'value' },
        'SUM(',
      )).to.be.true;
    });
  });
});
