import React from 'react';
import CodeModal from '../../../javascripts/dashboard/components/CodeModal';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('CodeModal', () => {
  const mockedProps = {
    triggerNode: <i className="fa fa-edit" />,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<CodeModal {...mockedProps} />)
    ).to.equal(true);
  });
  it('renders the trigger node', () => {
    const wrapper = mount(<CodeModal {...mockedProps} />);
    expect(wrapper.find('.fa-edit')).to.have.length(1);
  });
});
