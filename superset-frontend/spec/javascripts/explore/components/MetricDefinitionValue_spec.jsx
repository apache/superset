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

import MetricDefinitionValue from 'src/explore/components/MetricDefinitionValue';
import AdhocMetricOption from 'src/explore/components/AdhocMetricOption';
import AdhocMetric from 'src/explore/AdhocMetric';
import { AGGREGATES } from 'src/explore/constants';

const sumValueAdhocMetric = new AdhocMetric({
  column: { type: 'DOUBLE', column_name: 'value' },
  aggregate: AGGREGATES.SUM,
});

describe('MetricDefinitionValue', () => {
  it('renders a MetricOption given a saved metric', () => {
    const wrapper = shallow(
      <MetricDefinitionValue option={{ metric_name: 'a_saved_metric' }} />,
    );
    expect(wrapper.find('AdhocMetricOption')).toExist();
  });

  it('renders an AdhocMetricOption given an adhoc metric', () => {
    const wrapper = shallow(
      <MetricDefinitionValue
        onMetricEdit={() => {}}
        option={sumValueAdhocMetric}
      />,
    );
    expect(wrapper.find(AdhocMetricOption)).toExist();
  });
});
