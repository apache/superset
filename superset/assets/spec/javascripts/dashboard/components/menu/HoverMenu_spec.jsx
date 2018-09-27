import React from 'react';
import { shallow } from 'enzyme';
import { expect } from 'chai';

import HoverMenu from '../../../../../src/dashboard/components/menu/HoverMenu';

describe('HoverMenu', () => {
  it('should render a div.hover-menu', () => {
    const wrapper = shallow(<HoverMenu />);
    expect(wrapper.find('.hover-menu')).to.have.length(1);
  });
});
