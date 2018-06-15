import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { mount } from 'enzyme';
import { Modal } from 'react-bootstrap';
import ModalTrigger from './../../../../src/components/ModalTrigger';

import DisplayQueryButton from '../../../../src/explore/components/DisplayQueryButton';

describe('DisplayQueryButton', () => {
  const defaultProps = {
    animation: false,
    queryResponse: {
      query: 'SELECT * FROM foo',
      language: 'sql',
    },
    chartStatus: 'success',
    queryEndpoint: 'localhost',
  };

  it('is valid', () => {
    expect(React.isValidElement(<DisplayQueryButton {...defaultProps} />)).to.equal(true);
  });
  it('renders a button and a modal', () => {
    const wrapper = mount(<DisplayQueryButton {...defaultProps} />);
    expect(wrapper.find(ModalTrigger)).to.have.lengthOf(1);
    wrapper.find('.modal-trigger').simulate('click');
    expect(wrapper.find(Modal)).to.have.lengthOf(1);
  });
});
