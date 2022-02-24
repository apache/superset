// import { ChartProps } from '@superset-ui/core';
// import transformProps, {AAGUserIDFormData} from '../../src/plugin/transformProps';

// describe('AtAGlance tranformProps', () => {
//   const formData: AAGUserIDFormData  = {
//     colorScheme: 'bnbColors',
//     datasource: '3__table',
//     granularity_sqla: 'ds',
//     metric: 'sum__num',
//     series: 'name',
//     boldText: true,
//     headerFontSize: 'xs',
//     headerText: 'my text',
//     ipDashboardId: '',
//   };
//   const chartProps = new ChartProps({
//     formData,
//     width: 800,
//     height: 600,
//     queriesData: [
//       {
//         data: [{ name: 'Hulk', sum__num: 1 }],
//       },
//     ],
//   });

//   it('should tranform chart props for viz', () => {
//     expect(transformProps(chartProps)).toEqual({
//       width: 800,
//       height: 600,
//       boldText: true,
//       headerFontSize: 'xs',
//       headerText: 'my text',
//       data: [{ name: 'Hulk', sum__num: 1 }],
//     });
//   });
// });
