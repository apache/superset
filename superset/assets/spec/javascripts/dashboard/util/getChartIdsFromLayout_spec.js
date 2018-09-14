import { expect } from 'chai';

import getChartIdsFromLayout from '../../../../src/dashboard/util/getChartIdsFromLayout';
import {
  ROW_TYPE,
  CHART_TYPE,
} from '../../../../src/dashboard/util/componentTypes';

describe('getChartIdsFromLayout', () => {
  const mockLayout = {
    a: {
      id: 'a',
      type: CHART_TYPE,
      meta: { chartId: 'A' },
    },
    b: {
      id: 'b',
      type: CHART_TYPE,
      meta: { chartId: 'B' },
    },
    c: {
      id: 'c',
      type: ROW_TYPE,
      meta: { chartId: 'C' },
    },
  };

  it('should return an array of chartIds', () => {
    const result = getChartIdsFromLayout(mockLayout);
    expect(Array.isArray(result)).to.equal(true);
    expect(result.includes('A')).to.equal(true);
    expect(result.includes('B')).to.equal(true);
  });

  it('should return ids only from CHART_TYPE components', () => {
    const result = getChartIdsFromLayout(mockLayout);
    expect(result.length).to.equal(2);
    expect(result.includes('C')).to.equal(false);
  });
});
