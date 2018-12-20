import React from 'react';
import { shallow } from 'enzyme';
import { SuperChart } from '../../src';

describe('SuperChart', () => {
  it('does not render if chartType is not set', done => {
    const wrapper = shallow(<SuperChart />);
    setTimeout(() => {
      expect(wrapper.render().children()).toHaveLength(0);
      done();
    }, 5);
  });
});
