/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';
import { FormGroup } from 'react-bootstrap';

import AdhocFilter, { EXPRESSION_TYPES, CLAUSES } from '../../../../src/explore/AdhocFilter';
import AdhocMetric from '../../../../src/explore/AdhocMetric';
import AdhocFilterEditPopoverSimpleTabContent from '../../../../src/explore/components/AdhocFilterEditPopoverSimpleTabContent';
import { AGGREGATES } from '../../../../src/explore/constants';

const simpleAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  subject: 'value',
  operator: '>',
  comparator: '10',
  clause: CLAUSES.WHERE,
});

const simpleMultiAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  subject: 'value',
  operator: 'in',
  comparator: ['10'],
  clause: CLAUSES.WHERE,
});

const sumValueAdhocMetric = new AdhocMetric({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  column: { type: 'VARCHAR(255)', column_name: 'source' },
  aggregate: AGGREGATES.SUM,
});

const options = [
  { type: 'VARCHAR(255)', column_name: 'source' },
  { type: 'VARCHAR(255)', column_name: 'target' },
  { type: 'DOUBLE', column_name: 'value' },
  { saved_metric_name: 'my_custom_metric' },
  sumValueAdhocMetric,
];

function setup(overrides) {
  const onChange = sinon.spy();
  const onHeightChange = sinon.spy();
  const props = {
    adhocFilter: simpleAdhocFilter,
    onChange,
    onHeightChange,
    options,
    datasource: {},
    ...overrides,
  };
  const wrapper = shallow(<AdhocFilterEditPopoverSimpleTabContent {...props} />);
  return { wrapper, onChange, onHeightChange };
}

describe('AdhocFilterEditPopoverSimpleTabContent', () => {
  it('renders the simple tab form', () => {
    const { wrapper } = setup();
    expect(wrapper.find(FormGroup)).to.have.lengthOf(3);
  });

  it('passes the new adhocFilter to onChange after onSubjectChange', () => {
    const { wrapper, onChange } = setup();
    wrapper.instance().onSubjectChange({ type: 'VARCHAR(255)', column_name: 'source' });
    expect(onChange.calledOnce).to.be.true;
    expect(onChange.lastCall.args[0].equals((
      simpleAdhocFilter.duplicateWith({ subject: 'source' })
    ))).to.be.true;
  });

  it('may alter the clause in onSubjectChange if the old clause is not appropriate', () => {
    const { wrapper, onChange } = setup();
    wrapper.instance().onSubjectChange(sumValueAdhocMetric);
    expect(onChange.calledOnce).to.be.true;
    expect(onChange.lastCall.args[0].equals((
      simpleAdhocFilter.duplicateWith({
        subject: sumValueAdhocMetric.label,
        clause: CLAUSES.HAVING,
      })
    ))).to.be.true;
  });

  it('will convert from individual comparator to array if the operator changes to multi', () => {
    const { wrapper, onChange } = setup();
    wrapper.instance().onOperatorChange({ operator: 'in' });
    expect(onChange.calledOnce).to.be.true;
    expect(onChange.lastCall.args[0].comparator).to.have.lengthOf(1);
    expect(onChange.lastCall.args[0].comparator[0]).to.equal('10');
    expect(onChange.lastCall.args[0].operator).to.equal('in');
  });

  it('will convert from array to individual comparators if the operator changes from multi', () => {
    const { wrapper, onChange } = setup({ adhocFilter: simpleMultiAdhocFilter });
    wrapper.instance().onOperatorChange({ operator: '<' });
    expect(onChange.calledOnce).to.be.true;
    expect(onChange.lastCall.args[0].equals((
      simpleAdhocFilter.duplicateWith({ operator: '<', comparator: '10' })
    ))).to.be.true;
  });

  it('passes the new adhocFilter to onChange after onComparatorChange', () => {
    const { wrapper, onChange } = setup();
    wrapper.instance().onComparatorChange('20');
    expect(onChange.calledOnce).to.be.true;
    expect(onChange.lastCall.args[0].equals((
      simpleAdhocFilter.duplicateWith({ comparator: '20' })
    ))).to.be.true;
  });

  it('will filter operators for table datasources', () => {
    const { wrapper } = setup({ datasource: { type: 'table' } });
    expect(wrapper.instance().isOperatorRelevant('regex')).to.be.false;
    expect(wrapper.instance().isOperatorRelevant('LIKE')).to.be.true;
  });

  it('will filter operators for druid datasources', () => {
    const { wrapper } = setup({ datasource: { type: 'druid' } });
    expect(wrapper.instance().isOperatorRelevant('regex')).to.be.true;
    expect(wrapper.instance().isOperatorRelevant('LIKE')).to.be.false;
  });

  it('expands when its multi comparator input field expands', () => {
    const { wrapper, onHeightChange } = setup();

    wrapper.instance().multiComparatorComponent =
      { _selectRef: { select: { control: { clientHeight: 57 } } } };
    wrapper.instance().handleMultiComparatorInputHeightChange();

    expect(onHeightChange.calledOnce).to.be.true;
    expect(onHeightChange.lastCall.args[0]).to.equal(27);
  });
});
