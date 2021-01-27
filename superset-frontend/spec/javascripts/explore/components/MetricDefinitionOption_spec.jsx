/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import configureStore from 'redux-mock-store';
import { shallow } from 'enzyme';
import { ColumnOption, MetricOption } from '@superset-ui/chart-controls';

import MetricDefinitionOption from 'src/explore/components/controls/MetricControl/MetricDefinitionOption';
import AggregateOption from 'src/explore/components/AggregateOption';

describe('MetricDefinitionOption', () => {
  const mockStore = configureStore([]);
  const store = mockStore({});

  function setup(props) {
    return shallow(<MetricDefinitionOption store={store} {...props} />).dive();
  }

  it('renders a MetricOption given a saved metric', () => {
    const wrapper = setup({
      option: { metric_name: 'a_saved_metric', expression: 'COUNT(*)' },
    });
    expect(wrapper.find(MetricOption)).toExist();
  });

  it('renders a ColumnOption given a column', () => {
    const wrapper = setup({ option: { column_name: 'a_column' } });
    expect(wrapper.find(ColumnOption)).toExist();
  });

  it('renders an AggregateOption given an aggregate metric', () => {
    const wrapper = setup({ option: { aggregate_name: 'an_aggregate' } });
    expect(wrapper.find(AggregateOption)).toExist();
  });
});
