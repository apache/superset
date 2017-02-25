import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';
import ControlSetRow from '../../../../javascripts/explorev2/components/ControlRow';

describe('ControlSetRow', () => {
  it('renders a single row with one element', () => {
    const wrapper = shallow(<ControlSetRow controls={[<a />]} />);
    expect(wrapper.find('.row')).to.have.lengthOf(1);
    expect(wrapper.find('.row').find('a')).to.have.lengthOf(1);
  });
  it('renders a single row with two elements', () => {
    const wrapper = shallow(<ControlSetRow controls={[<a />, <a />]} />);
    expect(wrapper.find('.row')).to.have.lengthOf(1);
    expect(wrapper.find('.row').find('a')).to.have.lengthOf(2);
  });
});
