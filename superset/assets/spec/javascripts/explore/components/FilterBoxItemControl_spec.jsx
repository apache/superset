/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';
import { OverlayTrigger } from 'react-bootstrap';

import FilterBoxItemControl from '../../../../src/explore/components/controls/FilterBoxItemControl';
import FormRow from '../../../../src/components/FormRow';
import datasources from '../../../fixtures/mockDatasource';

const defaultProps = {
  datasource: datasources['7__table'],
  onChange: sinon.spy(),
};

describe('FilterBoxItemControl', () => {
  let wrapper;
  let inst;

  const getWrapper = (propOverrides) => {
    const props = { ...defaultProps, ...propOverrides };
    return shallow(<FilterBoxItemControl {...props} />);
  };
  beforeEach(() => {
    wrapper = getWrapper();
    inst = wrapper.instance();
  });

  it('renders an OverlayTrigger', () => {
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
  });

  it('renderForms does the job', () => {
    const popover = shallow(inst.renderForm());
    expect(popover.find(FormRow)).toHaveLength(7);
  });
});
