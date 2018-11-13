import React from 'react';
import { mount } from 'enzyme';

import CssEditor from '../../../../src/dashboard/components/CssEditor';

describe('CssEditor', () => {
  const mockedProps = {
    triggerNode: <i className="fa fa-edit" />,
  };
  it('is valid', () => {
    expect(React.isValidElement(<CssEditor {...mockedProps} />)).toBe(true);
  });
  it('renders the trigger node', () => {
    const wrapper = mount(<CssEditor {...mockedProps} />);
    expect(wrapper.find('.fa-edit')).toHaveLength(1);
  });
});
