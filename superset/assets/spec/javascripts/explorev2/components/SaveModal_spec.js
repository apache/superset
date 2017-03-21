import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { defaultFormData } from '../../../../javascripts/explorev2/stores/store';
import { SaveModal } from '../../../../javascripts/explorev2/components/SaveModal';
import { Modal, Button, Radio } from 'react-bootstrap';
import sinon from 'sinon';

const defaultProps = {
  can_edit: true,
  onHide: () => ({}),
  actions: {
    saveSlice: sinon.spy(),
  },
  form_data: defaultFormData,
  user_id: '1',
  dashboards: [],
  slice: {},
};

describe('SaveModal', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<SaveModal {...defaultProps} />);
  });

  it('renders a Modal with 7 inputs and 2 buttons', () => {
    expect(wrapper.find(Modal)).to.have.lengthOf(1);
    expect(wrapper.find('input')).to.have.lengthOf(2);
    expect(wrapper.find(Button)).to.have.lengthOf(2);
    expect(wrapper.find(Radio)).to.have.lengthOf(5);
  });

  it('does not show overwrite option for new slice', () => {
    defaultProps.slice = null;
    const wrapperNewSlice = shallow(<SaveModal {...defaultProps} />);
    expect(wrapperNewSlice.find('#overwrite-radio')).to.have.lengthOf(0);
    expect(wrapperNewSlice.find('#saveas-radio')).to.have.lengthOf(1);
  });

  it('disable overwrite option for non-owner', () => {
    defaultProps.slice = {};
    defaultProps.can_overwrite = false;
    const wrapperForNonOwner = shallow(<SaveModal {...defaultProps} />);
    const overwriteRadio = wrapperForNonOwner.find('#overwrite-radio');
    expect(overwriteRadio).to.have.lengthOf(1);
    expect(overwriteRadio.prop('disabled')).to.equal(true);
  });

  it('saves a new slice', () => {
    defaultProps.slice = {
      slice_id: 1,
      slice_name: 'title',
    };
    defaultProps.can_overwrite = false;
    const wrapperForNewSlice = shallow(<SaveModal {...defaultProps} />);
    const saveasRadio = wrapperForNewSlice.find('#saveas-radio');
    saveasRadio.simulate('click');
    expect(wrapperForNewSlice.state().action).to.equal('saveas');
  });

  it('overwrite a slice', () => {
    defaultProps.slice = {
      slice_id: 1,
      slice_name: 'title',
    };
    defaultProps.can_overwrite = true;
    const wrapperForOverwrite = shallow(<SaveModal {...defaultProps} />);
    const overwriteRadio = wrapperForOverwrite.find('#overwrite-radio');
    overwriteRadio.simulate('click');
    expect(wrapperForOverwrite.state().action).to.equal('overwrite');
  });
});
