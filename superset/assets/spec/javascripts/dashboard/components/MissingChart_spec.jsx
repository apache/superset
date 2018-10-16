import React from 'react';
import { shallow } from 'enzyme';

import Loading from '../../../../src/components/Loading';
import MissingChart from '../../../../src/dashboard/components/MissingChart';

describe('MissingChart', () => {
  function setup(overrideProps) {
    const wrapper = shallow(<MissingChart height={100} {...overrideProps} />);
    return wrapper;
  }

  it('renders a .missing-chart-container', () => {
    const wrapper = setup();
    expect(wrapper.find('.missing-chart-container')).toHaveLength(1);
  });

  it('renders a .missing-chart-body', () => {
    const wrapper = setup();
    expect(wrapper.find('.missing-chart-body')).toHaveLength(1);
  });

  it('renders a Loading', () => {
    const wrapper = setup();
    expect(wrapper.find(Loading)).toHaveLength(1);
  });
});
