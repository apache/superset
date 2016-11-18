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
  datasource_id: 1,
  datasource_name: 'birth_names',
  datasource_type: 'table',
  user_id: 1,
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
});
