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
/* eslint-disable no-unused-expressions */
import React from 'react';
import { shallow } from 'enzyme';

import { ColumnOption } from '@superset-ui/chart-controls';
import FilterDefinitionOption from 'src/explore/components/FilterDefinitionOption';
import AdhocMetricStaticOption from 'src/explore/components/AdhocMetricStaticOption';
import AdhocMetric, { EXPRESSION_TYPES } from 'src/explore/AdhocMetric';
import { AGGREGATES } from 'src/explore/constants';

const sumValueAdhocMetric = new AdhocMetric({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  column: { type: 'VARCHAR(255)', column_name: 'source' },
  aggregate: AGGREGATES.SUM,
});

describe('FilterDefinitionOption', () => {
  it('renders a ColumnOption given a column', () => {
    const wrapper = shallow(
      <FilterDefinitionOption option={{ column_name: 'a_column' }} />,
    );
    expect(wrapper.find(ColumnOption)).toHaveLength(1);
  });

  it('renders a AdhocMetricStaticOption given an adhoc metric', () => {
    const wrapper = shallow(
      <FilterDefinitionOption option={sumValueAdhocMetric} />,
    );
    expect(wrapper.find(AdhocMetricStaticOption)).toHaveLength(1);
  });

  it('renders the metric name given a saved metric', () => {
    const wrapper = shallow(
      <FilterDefinitionOption
        option={{ saved_metric_name: 'my_custom_metric' }}
      />,
    );
    expect(wrapper.text()).toBe('<ColumnTypeLabel />my_custom_metric');
  });
});
