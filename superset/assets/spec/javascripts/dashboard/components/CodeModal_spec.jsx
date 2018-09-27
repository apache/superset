import React from 'react';
import { mount } from 'enzyme';
import { expect } from 'chai';

import CodeModal from '../../../../src/dashboard/components/CodeModal';

describe('CodeModal', () => {
  const mockedProps = {
    triggerNode: <i className="fa fa-edit" />,
  };
  it('is valid', () => {
    expect(React.isValidElement(<CodeModal {...mockedProps} />)).to.equal(true);
  });
  it('renders the trigger node', () => {
    const wrapper = mount(<CodeModal {...mockedProps} />);
    expect(wrapper.find('.fa-edit')).to.have.length(1);
  });
});
