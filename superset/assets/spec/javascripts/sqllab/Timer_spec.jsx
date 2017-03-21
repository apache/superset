import React from 'react';
import Timer from '../../../javascripts/components/Timer';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { now } from '../../../javascripts/modules/dates';


describe('Timer', () => {
  const mockedProps = {
    startTime: now(),
    endTime: null,
    isRunning: true,
    state: 'warning',
  };
  it('renders', () => {
    expect(React.isValidElement(<Timer />)).to.equal(true);
  });
  it('renders with props', () => {
    expect(React.isValidElement(<Timer {...mockedProps} />))
    .to.equal(true);
  });
  it('renders a span', () => {
    const wrapper = shallow(<Timer {...mockedProps} />);
    expect(wrapper.find('span')).to.have.length(1);
  });
});
