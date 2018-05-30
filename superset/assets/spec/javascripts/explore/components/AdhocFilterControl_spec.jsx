/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';

import AdhocFilter, { EXPRESSION_TYPES, CLAUSES } from '../../../../src/explore/AdhocFilter';
import AdhocFilterControl from '../../../../src/explore/components/controls/AdhocFilterControl';
import AdhocMetric from '../../../../src/explore/AdhocMetric';
import { AGGREGATES, OPERATORS } from '../../../../src/explore/constants';
import OnPasteSelect from '../../../../src/components/OnPasteSelect';

const simpleAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  subject: 'value',
  operator: '>',
  comparator: '10',
  clause: CLAUSES.WHERE,
});

const sumValueAdhocMetric = new AdhocMetric({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  column: { type: 'VARCHAR(255)', column_name: 'source' },
  aggregate: AGGREGATES.SUM,
});

const savedMetric = { metric_name: 'sum__value', expression: 'SUM(value)' };

const columns = [
  { type: 'VARCHAR(255)', column_name: 'source' },
  { type: 'VARCHAR(255)', column_name: 'target' },
  { type: 'DOUBLE', column_name: 'value' },
];

const legacyFilter = { col: 'value', op: '>', val: '5' };
const legacyHavingFilter = { col: 'SUM(value)', op: '>', val: '10' };
const whereFilterText = 'target in (\'alpha\')';
const havingFilterText = 'SUM(value) < 20';

const formData = {
  filters: [legacyFilter],
  having: havingFilterText,
  having_filters: [legacyHavingFilter],
  metric: undefined,
  metrics: [sumValueAdhocMetric, savedMetric.saved_metric_name],
  where: whereFilterText,
};

function setup(overrides) {
  const onChange = sinon.spy();
  const props = {
    onChange,
    value: [simpleAdhocFilter],
    datasource: { type: 'table' },
    columns,
    savedMetrics: [savedMetric],
    formData,
    ...overrides,
  };
  const wrapper = shallow(<AdhocFilterControl {...props} />);
  return { wrapper, onChange };
}

describe('AdhocFilterControl', () => {
  it('renders an onPasteSelect', () => {
    const { wrapper } = setup();
    expect(wrapper.find(OnPasteSelect)).to.have.lengthOf(1);
  });

  it('will translate legacy filters into adhoc filters if no adhoc filters are present', () => {
    const { wrapper } = setup({ value: undefined });
    expect(wrapper.state('values')).to.have.lengthOf(4);
    expect(wrapper.state('values')[0].equals((
      new AdhocFilter({
        expressionType: EXPRESSION_TYPES.SIMPLE,
        subject: 'value',
        operator: '>',
        comparator: '5',
        clause: CLAUSES.WHERE,
      })
    ))).to.be.true;
    expect(wrapper.state('values')[1].equals((
      new AdhocFilter({
        expressionType: EXPRESSION_TYPES.SIMPLE,
        subject: 'SUM(value)',
        operator: '>',
        comparator: '10',
        clause: CLAUSES.HAVING,
      })
    ))).to.be.true;
    expect(wrapper.state('values')[2].equals((
      new AdhocFilter({
        expressionType: EXPRESSION_TYPES.SQL,
        sqlExpression: 'target in (\'alpha\')',
        clause: CLAUSES.WHERE,
      })
    ))).to.be.true;
    expect(wrapper.state('values')[3].equals((
      new AdhocFilter({
        expressionType: EXPRESSION_TYPES.SQL,
        sqlExpression: 'SUM(value) < 20',
        clause: CLAUSES.HAVING,
      })
    ))).to.be.true;
  });

  it('will ignore legacy filters if adhoc filters are present', () => {
    const { wrapper } = setup();
    expect(wrapper.state('values')).to.have.lengthOf(1);
    expect(wrapper.state('values')[0]).to.equal(simpleAdhocFilter);
  });

  it('handles saved metrics being selected to filter on', () => {
    const { wrapper, onChange } = setup({ value: [] });
    const select = wrapper.find(OnPasteSelect);
    select.simulate('change', [{ saved_metric_name: 'sum__value' }]);

    const adhocFilter = onChange.lastCall.args[0][0];
    expect(adhocFilter instanceof AdhocFilter).to.be.true;
    expect(adhocFilter.equals((
      new AdhocFilter({
        expressionType: EXPRESSION_TYPES.SQL,
        subject: savedMetric.expression,
        operator: OPERATORS['>'],
        comparator: 0,
        clause: CLAUSES.HAVING,
      })
    ))).to.be.true;
  });

  it('handles adhoc metrics being selected to filter on', () => {
    const { wrapper, onChange } = setup({ value: [] });
    const select = wrapper.find(OnPasteSelect);
    select.simulate('change', [sumValueAdhocMetric]);

    const adhocFilter = onChange.lastCall.args[0][0];
    expect(adhocFilter instanceof AdhocFilter).to.be.true;
    expect(adhocFilter.equals((
      new AdhocFilter({
        expressionType: EXPRESSION_TYPES.SQL,
        subject: sumValueAdhocMetric.label,
        operator: OPERATORS['>'],
        comparator: 0,
        clause: CLAUSES.HAVING,
      })
    ))).to.be.true;
  });

  it('handles columns being selected to filter on', () => {
    const { wrapper, onChange } = setup({ value: [] });
    const select = wrapper.find(OnPasteSelect);
    select.simulate('change', [columns[0]]);

    const adhocFilter = onChange.lastCall.args[0][0];
    expect(adhocFilter instanceof AdhocFilter).to.be.true;
    expect(adhocFilter.equals((
      new AdhocFilter({
        expressionType: EXPRESSION_TYPES.SIMPLE,
        subject: columns[0].column_name,
        operator: OPERATORS['=='],
        comparator: '',
        clause: CLAUSES.WHERE,
      })
    ))).to.be.true;
  });

  it('persists existing filters even when new filters are added', () => {
    const { wrapper, onChange } = setup();
    const select = wrapper.find(OnPasteSelect);
    select.simulate('change', [simpleAdhocFilter, columns[0]]);

    const existingAdhocFilter = onChange.lastCall.args[0][0];
    expect(existingAdhocFilter instanceof AdhocFilter).to.be.true;
    expect(existingAdhocFilter.equals(simpleAdhocFilter)).to.be.true;

    const newAdhocFilter = onChange.lastCall.args[0][1];
    expect(newAdhocFilter instanceof AdhocFilter).to.be.true;
    expect(newAdhocFilter.equals((
      new AdhocFilter({
        expressionType: EXPRESSION_TYPES.SIMPLE,
        subject: columns[0].column_name,
        operator: OPERATORS['=='],
        comparator: '',
        clause: CLAUSES.WHERE,
      })
    ))).to.be.true;
  });
});
