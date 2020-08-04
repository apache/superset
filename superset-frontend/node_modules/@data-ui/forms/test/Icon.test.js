import React from 'react';
import { shallow } from 'enzyme';

import BaseIcon from '../src/icons/BaseIcon';

describe('<BaseIcon />', () => {
  it('it should be defined', () => {
    expect(BaseIcon).toBeDefined();
  });

  it('it should render an <svg>', () => {
    const svg = props => <svg {...props} />;
    const wrapper = shallow(<BaseIcon svg={svg} />);
    expect(wrapper.is('svg')).toBe(true);
  });
});
