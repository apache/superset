/* eslint-disable no-unused-expressions */
import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';

import MetricDefinitionOption from '../../../../javascripts/explore/components/MetricDefinitionOption';
import MetricOption from '../../../../javascripts/components/MetricOption';
import ColumnOption from '../../../../javascripts/components/ColumnOption';
import AggregateOption from '../../../../javascripts/explore/components/AggregateOption';

describe('MetricDefinitionOption', () => {
  it('renders a MetricOption given a saved metric', () => {
    const wrapper = shallow(<MetricDefinitionOption option={{ metric_name: 'a_saved_metric' }} />);
    expect(wrapper.find(MetricOption)).to.have.lengthOf(1);
  });

  it('renders a ColumnOption given a column', () => {
    const wrapper = shallow(<MetricDefinitionOption option={{ column_name: 'a_column' }} />);
    expect(wrapper.find(ColumnOption)).to.have.lengthOf(1);
  });

  it('renders an AggregateOption given an aggregate metric', () => {
    const wrapper = shallow(<MetricDefinitionOption option={{ aggregate_name: 'an_aggregate' }} />);
    expect(wrapper.find(AggregateOption)).to.have.lengthOf(1);
  });
});
