/* eslint-disable no-unused-expressions */
import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';

import AdhocMetricStaticOption from '../../../../src/controls/AdhocMetricStaticOption';
import AdhocMetric, { EXPRESSION_TYPES } from '../../../../src/controls/AdhocMetric';
import { AGGREGATES } from '../../../../src/controls/constants';

const sumValueAdhocMetric = new AdhocMetric({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  column: { type: 'VARCHAR(255)', column_name: 'source' },
  aggregate: AGGREGATES.SUM,
});

describe('AdhocMetricStaticOption', () => {
  it('renders the adhoc metrics label', () => {
    const wrapper = shallow(<AdhocMetricStaticOption adhocMetric={sumValueAdhocMetric} />);
    expect(wrapper.text()).to.equal('SUM(source)');
  });
});
