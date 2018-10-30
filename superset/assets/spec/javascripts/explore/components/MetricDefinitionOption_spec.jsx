import React from 'react';
import configureStore from 'redux-mock-store';
import { shallow } from 'enzyme';

import MetricDefinitionOption from '../../../../src/explore/components/MetricDefinitionOption';
import MetricOption from '../../../../src/components/MetricOption';
import ColumnOption from '../../../../src/components/ColumnOption';
import AggregateOption from '../../../../src/explore/components/AggregateOption';

describe('MetricDefinitionOption', () => {
  const mockStore = configureStore([]);
  const store = mockStore({});

  function setup(props) {
    return shallow(<MetricDefinitionOption {...props} />, { context: { store } }).dive();
  }

  it('renders a MetricOption given a saved metric', () => {
    const wrapper = setup({ option: { metric_name: 'a_saved_metric' } });
    expect(wrapper.find(MetricOption)).toHaveLength(1);
  });

  it('renders a ColumnOption given a column', () => {
    const wrapper = setup({ option: { column_name: 'a_column' } });
    expect(wrapper.find(ColumnOption)).toHaveLength(1);
  });

  it('renders an AggregateOption given an aggregate metric', () => {
    const wrapper = setup({ option: { aggregate_name: 'an_aggregate' } });
    expect(wrapper.find(AggregateOption)).toHaveLength(1);
  });
});
