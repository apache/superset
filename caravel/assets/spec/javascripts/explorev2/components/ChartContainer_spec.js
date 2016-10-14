// this test must be commented out because ChartContainer is now importing files
// from visualizations/*.js which are also importing css files which breaks in the testing env

// import React from 'react';
// import { expect } from 'chai';
// import { describe, it } from 'mocha';

// import ChartContainer from '../../../../javascripts/explorev2/components/ChartContainer';

// describe('ChartContainer', () => {
//   const mockProps = {
//     sliceName: 'Trend Line',
//     vizType: 'line',
//     height: '500px',
//   };

//   it('renders when vizType is line', () => {
//     expect(
//       React.isValidElement(<ChartContainer {...mockProps} />)
//     ).to.equal(true);
//   });
// });
