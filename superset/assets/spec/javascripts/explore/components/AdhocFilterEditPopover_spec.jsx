/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';
import { Button, Popover, Tab, Tabs } from 'react-bootstrap';

import AdhocFilter, { EXPRESSION_TYPES, CLAUSES } from '../../../../src/explore/AdhocFilter';
import AdhocMetric from '../../../../src/explore/AdhocMetric';
import AdhocFilterEditPopover from '../../../../src/explore/components/AdhocFilterEditPopover';
import AdhocFilterEditPopoverSimpleTabContent from '../../../../src/explore/components/AdhocFilterEditPopoverSimpleTabContent';
import AdhocFilterEditPopoverSqlTabContent from '../../../../src/explore/components/AdhocFilterEditPopoverSqlTabContent';
import { AGGREGATES } from '../../../../src/explore/constants';

const simpleAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  subject: 'value',
  operator: '>',
  comparator: '10',
  clause: CLAUSES.WHERE,
});

const sqlAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SQL,
  sqlExpression: 'value > 10',
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
  const onClose = sinon.spy();
  const onResize = sinon.spy();
  const props = {
    adhocFilter: simpleAdhocFilter,
    onChange,
    onClose,
    onResize,
    options,
    datasource: {},
    ...overrides,
  };
  const wrapper = shallow(<AdhocFilterEditPopover {...props} />);
  return { wrapper, onChange, onClose, onResize };
}

describe('AdhocFilterEditPopover', () => {
  it('renders simple tab content by default', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Popover)).to.have.lengthOf(1);
    expect(wrapper.find(Tabs)).to.have.lengthOf(1);
    expect(wrapper.find(Tab)).to.have.lengthOf(2);
    expect(wrapper.find(Button)).to.have.lengthOf(2);
    expect(wrapper.find(AdhocFilterEditPopoverSimpleTabContent)).to.have.lengthOf(1);
  });

  it('renders sql tab content when the adhoc filter expressionType is sql', () => {
    const { wrapper } = setup({ adhocFilter: sqlAdhocFilter });
    expect(wrapper.find(Popover)).to.have.lengthOf(1);
    expect(wrapper.find(Tabs)).to.have.lengthOf(1);
    expect(wrapper.find(Tab)).to.have.lengthOf(2);
    expect(wrapper.find(Button)).to.have.lengthOf(2);
    expect(wrapper.find(AdhocFilterEditPopoverSqlTabContent)).to.have.lengthOf(1);
  });

  it('overwrites the adhocFilter in state with onAdhocFilterChange', () => {
    const { wrapper } = setup();
    wrapper.instance().onAdhocFilterChange(sqlAdhocFilter);
    expect(wrapper.state('adhocFilter')).to.deep.equal(sqlAdhocFilter);
  });

  it('prevents saving if the filter is invalid', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Button).find({ disabled: true })).to.have.lengthOf(0);
    wrapper.instance().onAdhocFilterChange(simpleAdhocFilter.duplicateWith({ operator: null }));
    expect(wrapper.find(Button).find({ disabled: true })).to.have.lengthOf(1);
    wrapper.instance().onAdhocFilterChange(sqlAdhocFilter);
    expect(wrapper.find(Button).find({ disabled: true })).to.have.lengthOf(0);
  });

  it('highlights save if changes are present', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Button).find({ bsStyle: 'primary' })).to.have.lengthOf(0);
    wrapper.instance().onAdhocFilterChange(sqlAdhocFilter);
    expect(wrapper.find(Button).find({ bsStyle: 'primary' })).to.have.lengthOf(1);
  });

  it('will initiate a drag when clicked', () => {
    const { wrapper } = setup();
    wrapper.instance().onDragDown = sinon.spy();
    wrapper.instance().forceUpdate();

    expect(wrapper.find('i.glyphicon-resize-full')).to.have.lengthOf(1);
    expect(wrapper.instance().onDragDown.calledOnce).to.be.false;
    wrapper.find('i.glyphicon-resize-full').simulate('mouseDown');
    expect(wrapper.instance().onDragDown.calledOnce).to.be.true;
  });
});
