/* eslint-disable no-unused-expressions */
import React from 'react';
import { shallow } from 'enzyme';

import MetricDefinitionValue from '../../../../src/explore/components/MetricDefinitionValue';
import MetricOption from '../../../../src/components/MetricOption';
import AdhocMetricOption from '../../../../src/explore/components/AdhocMetricOption';
import AdhocMetric from '../../../../src/explore/AdhocMetric';
import { AGGREGATES } from '../../../../src/explore/constants';

const sumValueAdhocMetric = new AdhocMetric({
  column: { type: 'DOUBLE', column_name: 'value' },
  aggregate: AGGREGATES.SUM,
});

describe('MetricDefinitionValue', () => {
  it('renders a MetricOption given a saved metric', () => {
    const wrapper = shallow(<MetricDefinitionValue option={{ metric_name: 'a_saved_metric' }} />);
    expect(wrapper.find(MetricOption)).toHaveLength(1);
  });

  it('renders an AdhocMetricOption given an adhoc metric', () => {
    const wrapper = shallow((
      <MetricDefinitionValue onMetricEdit={() => {}} option={sumValueAdhocMetric} />
    ));
    expect(wrapper.find(AdhocMetricOption)).toHaveLength(1);
  });
});
