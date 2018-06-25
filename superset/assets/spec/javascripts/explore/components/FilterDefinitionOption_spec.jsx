/* eslint-disable no-unused-expressions */
import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';

import FilterDefinitionOption from '../../../../src/controls/FilterDefinitionOption';
import ColumnOption from '../../../../src/components/ColumnOption';
import AdhocMetricStaticOption from '../../../../src/controls/AdhocMetricStaticOption';
import AdhocMetric, { EXPRESSION_TYPES } from '../../../../src/controls/AdhocMetric';
import { AGGREGATES } from '../../../../src/controls/constants';

const sumValueAdhocMetric = new AdhocMetric({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  column: { type: 'VARCHAR(255)', column_name: 'source' },
  aggregate: AGGREGATES.SUM,
});

describe('FilterDefinitionOption', () => {
  it('renders a ColumnOption given a column', () => {
    const wrapper = shallow(<FilterDefinitionOption option={{ column_name: 'a_column' }} />);
    expect(wrapper.find(ColumnOption)).to.have.lengthOf(1);
  });

  it('renders a AdhocMetricStaticOption given an adhoc metric', () => {
    const wrapper = shallow(<FilterDefinitionOption option={sumValueAdhocMetric} />);
    expect(wrapper.find(AdhocMetricStaticOption)).to.have.lengthOf(1);
  });

  it('renders the metric name given a saved metric', () => {
    const wrapper = shallow((
      <FilterDefinitionOption option={{ saved_metric_name: 'my_custom_metric' }} />
    ));
    expect(wrapper.text()).to.equal('<ColumnTypeLabel />my_custom_metric');
  });
});
