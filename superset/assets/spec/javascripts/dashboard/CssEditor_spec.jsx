import React from 'react';
import CssEditor from '../../../javascripts/dashboard/components/CssEditor';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';


describe('CssEditor', () => {
  const mockedProps = {
    triggerNode: <i className="fa fa-edit" />,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<CssEditor {...mockedProps} />)
    ).to.equal(true);
  });
  it('renders the trigger node', () => {
    const wrapper = mount(<CssEditor {...mockedProps} />);
    expect(wrapper.find('.fa-edit')).to.have.length(1);
  });
});
