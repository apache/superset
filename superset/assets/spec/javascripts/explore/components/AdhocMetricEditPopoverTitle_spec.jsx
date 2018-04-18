/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';
import { OverlayTrigger } from 'react-bootstrap';

import AdhocMetric from '../../../../src/explore/AdhocMetric';
import AdhocMetricEditPopoverTitle from '../../../../src/explore/components/AdhocMetricEditPopoverTitle';
import { AGGREGATES } from '../../../../src/explore/constants';

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
  const props = {
    adhocMetric: sumValueAdhocMetric,
    onChange,
    ...overrides,
  };
  const wrapper = shallow(<AdhocMetricEditPopoverTitle {...props} />);
  return { wrapper, onChange };
}

describe('AdhocMetricEditPopoverTitle', () => {
  it('renders an OverlayTrigger wrapper with the title', () => {
    const { wrapper } = setup();
    expect(wrapper.find(OverlayTrigger)).to.have.lengthOf(1);
    expect(wrapper.find(OverlayTrigger).dive().text()).to.equal('My Metric\xa0');
  });

  it('transfers to edit mode when clicked', () => {
    const { wrapper } = setup();
    expect(wrapper.state('isEditable')).to.be.false;
    wrapper.simulate('click');
    expect(wrapper.state('isEditable')).to.be.true;
  });
});
