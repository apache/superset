/* eslint-disable no-unused-expressions */
import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';

import MetricDefinitionValue from '../../../../javascripts/explore/components/MetricDefinitionValue';
import MetricOption from '../../../../javascripts/components/MetricOption';
import AdhocMetricOption from '../../../../javascripts/explore/components/AdhocMetricOption';
import AdhocMetric from '../../../../javascripts/explore/AdhocMetric';
import { AGGREGATES } from '../../../../javascripts/explore/constants';

const sumValueAdhocMetric = new AdhocMetric({
  column: { type: 'DOUBLE', column_name: 'value' },
  aggregate: AGGREGATES.SUM,
});

describe('MetricDefinitionValue', () => {
  it('renders a MetricOption given a saved metric', () => {
    const wrapper = shallow(<MetricDefinitionValue option={{ metric_name: 'a_saved_metric' }} />);
    expect(wrapper.find(MetricOption)).to.have.lengthOf(1);
  });

  it('renders an AdhocMetricOption given an adhoc metric', () => {
    const wrapper = shallow((
      <MetricDefinitionValue onMetricEdit={() => {}} option={sumValueAdhocMetric} />
    ));
    expect(wrapper.find(AdhocMetricOption)).to.have.lengthOf(1);
  });
});
