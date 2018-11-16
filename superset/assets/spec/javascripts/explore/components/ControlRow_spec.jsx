import React from 'react';
import { shallow } from 'enzyme';
import ControlSetRow from '../../../../src/explore/components/ControlRow';

describe('ControlSetRow', () => {
  it('renders a single row with one element', () => {
    const wrapper = shallow(<ControlSetRow controls={[<a />]} />);
    expect(wrapper.find('.row')).toHaveLength(1);
    expect(wrapper.find('.row').find('a')).toHaveLength(1);
  });
  it('renders a single row with two elements', () => {
    const wrapper = shallow(<ControlSetRow controls={[<a />, <a />]} />);
    expect(wrapper.find('.row')).toHaveLength(1);
    expect(wrapper.find('.row').find('a')).toHaveLength(2);
  });
});
