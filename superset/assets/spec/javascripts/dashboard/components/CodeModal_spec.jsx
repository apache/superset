import React from 'react';
import { mount } from 'enzyme';

import CodeModal from '../../../../src/dashboard/components/CodeModal';

describe('CodeModal', () => {
  const mockedProps = {
    triggerNode: <i className="fa fa-edit" />,
  };
  it('is valid', () => {
    expect(React.isValidElement(<CodeModal {...mockedProps} />)).toBe(true);
  });
  it('renders the trigger node', () => {
    const wrapper = mount(<CodeModal {...mockedProps} />);
    expect(wrapper.find('.fa-edit')).toHaveLength(1);
  });
});
