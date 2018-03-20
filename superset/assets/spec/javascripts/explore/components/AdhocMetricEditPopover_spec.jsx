/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';
import { Button, FormGroup, Popover } from 'react-bootstrap';

import AdhocMetric from '../../../../javascripts/explore/AdhocMetric';
import AdhocMetricEditPopover from '../../../../javascripts/explore/components/AdhocMetricEditPopover';
import { AGGREGATES } from '../../../../javascripts/explore/constants';

const columns = [
  { type: 'VARCHAR(255)', column_name: 'source' },
  { type: 'VARCHAR(255)', column_name: 'target' },
  { type: 'DOUBLE', column_name: 'value' },
];

const sumValueAdhocMetric = new AdhocMetric({
  column: columns[2],
  aggregate: AGGREGATES.SUM,
});

function setup(overrides) {
  const onChange = sinon.spy();
  const onClose = sinon.spy();
  const props = {
    adhocMetric: sumValueAdhocMetric,
    onChange,
    onClose,
    columns,
    ...overrides,
  };
  const wrapper = shallow(<AdhocMetricEditPopover {...props} />);
  return { wrapper, onChange, onClose };
}

describe('AdhocMetricEditPopover', () => {
  it('renders a popover with edit metric form contents', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Popover)).to.have.lengthOf(1);
    expect(wrapper.find(FormGroup)).to.have.lengthOf(2);
    expect(wrapper.find(Button)).to.have.lengthOf(2);
  });

  it('overwrites the adhocMetric in state with onColumnChange', () => {
    const { wrapper } = setup();
    wrapper.instance().onColumnChange(columns[0]);
    expect(wrapper.state('adhocMetric')).to.deep.equal(sumValueAdhocMetric.duplicateWith({ column: columns[0] }));
  });

  it('overwrites the adhocMetric in state with onAggregateChange', () => {
    const { wrapper } = setup();
    wrapper.instance().onAggregateChange({ aggregate: AGGREGATES.AVG });
    expect(wrapper.state('adhocMetric')).to.deep.equal(sumValueAdhocMetric.duplicateWith({ aggregate: AGGREGATES.AVG }));
  });

  it('overwrites the adhocMetric in state with onLabelChange', () => {
    const { wrapper } = setup();
    wrapper.instance().onLabelChange({ target: { value: 'new label' } });
    expect(wrapper.state('adhocMetric').label).to.equal('new label');
    expect(wrapper.state('adhocMetric').hasCustomLabel).to.be.true;
  });

  it('returns to default labels when the custom label is cleared', () => {
    const { wrapper } = setup();
    wrapper.instance().onLabelChange({ target: { value: 'new label' } });
    wrapper.instance().onLabelChange({ target: { value: '' } });
    expect(wrapper.state('adhocMetric').label).to.equal('SUM(value)');
    expect(wrapper.state('adhocMetric').hasCustomLabel).to.be.false;
  });

  it('prevents saving if no column or aggregate is chosen', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Button).find({ disabled: true })).to.have.lengthOf(0);
    wrapper.instance().onColumnChange(null);
    expect(wrapper.find(Button).find({ disabled: true })).to.have.lengthOf(1);
    wrapper.instance().onColumnChange({ column: columns[0] });
    expect(wrapper.find(Button).find({ disabled: true })).to.have.lengthOf(0);
    wrapper.instance().onAggregateChange(null);
    expect(wrapper.find(Button).find({ disabled: true })).to.have.lengthOf(1);
  });

  it('highlights save if changes are present', () => {
    const { wrapper } = setup();
    expect(wrapper.find(Button).find({ bsStyle: 'primary' })).to.have.lengthOf(0);
    wrapper.instance().onColumnChange({ column: columns[1] });
    expect(wrapper.find(Button).find({ bsStyle: 'primary' })).to.have.lengthOf(1);
  });
});
