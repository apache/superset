import React from 'react';
import { mount } from 'enzyme';
import { expect } from 'chai';

import CssEditor from '../../../../src/dashboard/components/CssEditor';

describe('CssEditor', () => {
  const mockedProps = {
    triggerNode: <i className="fa fa-edit" />,
  };
  it('is valid', () => {
    expect(React.isValidElement(<CssEditor {...mockedProps} />)).to.equal(true);
  });
  it('renders the trigger node', () => {
    const wrapper = mount(<CssEditor {...mockedProps} />);
    expect(wrapper.find('.fa-edit')).to.have.length(1);
  });
});
