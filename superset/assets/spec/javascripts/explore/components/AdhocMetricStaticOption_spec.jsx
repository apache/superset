/* eslint-disable no-unused-expressions */
import React from 'react';
import { shallow } from 'enzyme';

import AdhocMetricStaticOption from '../../../../src/explore/components/AdhocMetricStaticOption';
import AdhocMetric, { EXPRESSION_TYPES } from '../../../../src/explore/AdhocMetric';
import { AGGREGATES } from '../../../../src/explore/constants';

const sumValueAdhocMetric = new AdhocMetric({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  column: { type: 'VARCHAR(255)', column_name: 'source' },
  aggregate: AGGREGATES.SUM,
});

describe('AdhocMetricStaticOption', () => {
  it('renders the adhoc metrics label', () => {
    const wrapper = shallow(<AdhocMetricStaticOption adhocMetric={sumValueAdhocMetric} />);
    expect(wrapper.text()).toBe('SUM(source)');
  });
});
