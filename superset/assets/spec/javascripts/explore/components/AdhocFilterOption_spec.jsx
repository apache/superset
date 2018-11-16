/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';
import { Label, OverlayTrigger } from 'react-bootstrap';

import AdhocFilter, { EXPRESSION_TYPES, CLAUSES } from '../../../../src/explore/AdhocFilter';
import AdhocFilterOption from '../../../../src/explore/components/AdhocFilterOption';

const simpleAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  subject: 'value',
  operator: '>',
  comparator: '10',
  clause: CLAUSES.WHERE,
});

function setup(overrides) {
  const onFilterEdit = sinon.spy();
  const props = {
    adhocFilter: simpleAdhocFilter,
    onFilterEdit,
    options: [],
    datasource: {},
    ...overrides,
  };
  const wrapper = shallow(<AdhocFilterOption {...props} />);
  return { wrapper };
}

describe('AdhocFilterOption', () => {
  it('renders an overlay trigger wrapper for the label', () => {
    const { wrapper } = setup();
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
    expect(wrapper.find(Label)).toHaveLength(1);
  });
});
