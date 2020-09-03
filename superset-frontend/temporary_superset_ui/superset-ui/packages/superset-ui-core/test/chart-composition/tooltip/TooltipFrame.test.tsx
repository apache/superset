import React from 'react';
import { shallow } from 'enzyme';
import { TooltipFrame } from '@superset-ui/core/src';

describe('TooltipFrame', () => {
  it('sets className', () => {
    const wrapper = shallow(
      <TooltipFrame className="test-class">
        <span>Hi!</span>
      </TooltipFrame>,
    );
    expect(wrapper.hasClass('test-class')).toEqual(true);
  });

  it('renders', () => {
    const wrapper = shallow(
      <TooltipFrame>
        <span>Hi!</span>
      </TooltipFrame>,
    );
    const span = wrapper.find('span');
    expect(span).toHaveLength(1);
    expect(span.text()).toEqual('Hi!');
  });
});
