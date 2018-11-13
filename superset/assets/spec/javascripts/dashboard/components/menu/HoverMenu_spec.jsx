import React from 'react';
import { shallow } from 'enzyme';

import HoverMenu from '../../../../../src/dashboard/components/menu/HoverMenu';

describe('HoverMenu', () => {
  it('should render a div.hover-menu', () => {
    const wrapper = shallow(<HoverMenu />);
    expect(wrapper.find('.hover-menu')).toHaveLength(1);
  });
});
