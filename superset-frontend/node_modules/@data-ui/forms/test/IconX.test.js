import React from 'react';
import { shallow } from 'enzyme';

import IconX from '../src/icons/IconX';

describe('<IconX />', () => {
  it('it should be defined', () => {
    expect(IconX).toBeDefined();
  });

  it('it should render an <svg>', () => {
    const wrapper = shallow(<IconX />);

    expect(
      wrapper
        .dive() // BaseIcon
        .dive() // IconX
        .find('svg'),
    ).toHaveLength(1);
  });
});
