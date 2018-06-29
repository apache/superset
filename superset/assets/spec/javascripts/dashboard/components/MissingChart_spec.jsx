import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import Loading from '../../../../src/components/Loading';
import MissingChart from '../../../../src/dashboard/components/MissingChart';

describe('MissingChart', () => {
  function setup(overrideProps) {
    const wrapper = shallow(<MissingChart height={100} {...overrideProps} />);
    return wrapper;
  }

  it('renders a .missing-chart-container', () => {
    const wrapper = setup();
    expect(wrapper.find('.missing-chart-container')).to.have.length(1);
  });

  it('renders a .missing-chart-body', () => {
    const wrapper = setup();
    expect(wrapper.find('.missing-chart-body')).to.have.length(1);
  });

  it('renders a Loading', () => {
    const wrapper = setup();
    expect(wrapper.find(Loading)).to.have.length(1);
  });
});
