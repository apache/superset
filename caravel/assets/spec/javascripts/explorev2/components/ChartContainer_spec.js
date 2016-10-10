import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';

import ChartContainer from '../../../../javascripts/explorev2/components/ChartContainer';

describe('ChartContainer', () => {
  const mockProps = {
    data: [
      {
        classed: '',
        key: 'Label 1',
        values: [
          {
            x: -158766400000,
            y: 57,
          },
          {
            x: -156766400000,
            y: 157,
          },
          {
            x: -157766400000,
            y: 257,
          },
        ],
      },
    ],
    sliceName: 'Trend Line',
    vizType: 'line',
    height: '500px',
  };

  it('renders when vizType is line', () => {
    expect(
      React.isValidElement(<ChartContainer {...mockProps} />)
    ).to.equal(true);
  });
});
