import React from 'react';
import { shallow } from 'enzyme';
import { OverlayTrigger } from 'react-bootstrap';
import InfoTooltipWithTrigger from '../src/InfoTooltipWithTrigger';

describe('InfoTooltipWithTrigger', () => {
  it('renders a tooltip', () => {
    const wrapper = shallow(<InfoTooltipWithTrigger label="test" tooltip="this is a test" />);
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
  });

  it('renders an info icon', () => {
    const wrapper = shallow(<InfoTooltipWithTrigger />);
    expect(wrapper.find('.fa-info-circle')).toHaveLength(1);
  });

  it('responds to keypresses', () => {
    const clickHandler = jest.fn();
    const wrapper = shallow(
      <InfoTooltipWithTrigger label="test" tooltip="this is a test" onClick={clickHandler} />,
    );
    wrapper.find('.fa-info-circle').simulate('keypress', { key: 'Tab' });
    expect(clickHandler).toHaveBeenCalledTimes(0);
    wrapper.find('.fa-info-circle').simulate('keypress', { key: 'Enter' });
    expect(clickHandler).toHaveBeenCalledTimes(1);
    wrapper.find('.fa-info-circle').simulate('keypress', { key: ' ' });
    expect(clickHandler).toHaveBeenCalledTimes(2);
  });

  it('has a bsStyle', () => {
    const wrapper = shallow(<InfoTooltipWithTrigger bsStyle="something" />);
    expect(wrapper.find('.text-something')).toHaveLength(1);
  });
});
