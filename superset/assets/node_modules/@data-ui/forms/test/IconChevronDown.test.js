import React from 'react';
import { shallow } from 'enzyme';

import IconChevronDown from '../src/icons/IconChevronDown';

describe('<IconChevronDown />', () => {
  test('it should be defined', () => {
    expect(IconChevronDown).toBeDefined();
  });

  it('it should render an <svg>', () => {
    const wrapper = shallow(<IconChevronDown />);
    expect(
      wrapper
        .dive() // BaseIcon
        .dive() // IconX
        .find('svg').length,
    ).toBe(1);
  });
});
