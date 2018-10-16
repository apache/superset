/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';
import { Label, OverlayTrigger } from 'react-bootstrap';

import AdhocMetric from '../../../../src/explore/AdhocMetric';
import AdhocMetricOption from '../../../../src/explore/components/AdhocMetricOption';
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
  const onMetricEdit = sinon.spy();
  const props = {
    adhocMetric: sumValueAdhocMetric,
    onMetricEdit,
    columns,
    ...overrides,
  };
  const wrapper = shallow(<AdhocMetricOption {...props} />);
  return { wrapper, onMetricEdit };
}

describe('AdhocMetricOption', () => {
  it('renders an overlay trigger wrapper for the label', () => {
    const { wrapper } = setup();
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
    expect(wrapper.find(Label)).toHaveLength(1);
  });
});
