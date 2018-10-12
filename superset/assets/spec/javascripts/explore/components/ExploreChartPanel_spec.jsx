import React from 'react';

import ChartContainer from '../../../../src/explore/components/ExploreChartPanel';

describe('ChartContainer', () => {
  const mockProps = {
    sliceName: 'Trend Line',
    vizType: 'line',
    height: '500px',
  };

  it('renders when vizType is line', () => {
    expect(
      React.isValidElement(<ChartContainer {...mockProps} />),
    ).toBe(true);
  });
});
