// // SupersetPluginChartContourPlot.tsx

// import React, { useEffect, createRef } from 'react';
// import { styled } from '@superset-ui/core';
// import Plot from 'react-plotly.js';
// import {
//   SupersetPluginChartContourPlotProps,
//   SupersetPluginChartContourPlotStylesProps,
// } from './types';

// const Styles = styled.div<SupersetPluginChartContourPlotStylesProps>`
//   background-color: ${({ theme }) => theme.colors.secondary.light2};
//   padding: ${({ theme }) => theme.gridUnit * 4}px;
//   border-radius: ${({ theme }) => theme.gridUnit * 2}px;
//   height: ${({ height }) => height}px;
//   width: ${({ width }) => width}px;

//   h3 {
//     margin-top: 0;
//     margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
//     font-size: ${({ theme, headerFontSize }) =>
//       theme.typography.sizes[headerFontSize]}px;
//     font-weight: ${({ theme, boldText }) =>
//       theme.typography.weights[boldText ? 'bold' : 'normal']};
//   }
// `;

// export default function SupersetPluginChartContourPlot(
//   props: SupersetPluginChartContourPlotProps,
// ) {
//   const {
//     data,
//     height,
//     width,
//     headerText,
//     boldText,
//     headerFontSize,
//     contourLevels,
//     colorScheme,
//     showLabels,
//   } = props;
//   const rootElem = createRef<HTMLDivElement>();
//   // const data = mockData;

//   useEffect(() => {
//     const root = rootElem.current as HTMLElement;
//     console.log('Plugin element', root);
//   }, []);

//   console.log('Plugin props', props);

//   // const plotData = [
//   //   {
//   //     // z: data.map(d => d.z),
//   //     // x: data.map(d => d.x),
//   //     // y: data.map(d => d.y),
//   //     // type: 'contour',
//   //     z: [
//   //       [10, 10.625, 12.5, 15.625, 20],
//   //       [5.625, 6.25, 8.125, 11.25, 15.625],
//   //       [2.5, 3.125, 5, 8.125, 12.5],
//   //       [0.625, 1.25, 3.125, 6.25, 10.625],
//   //       [0, 0.625, 2.5, 5.625, 10],
//   //     ],
//   //     x: [-9, -6, -5, -3, -1],
//   //     y: [0, 1, 4, 5, 7],
//   //   },
//   // ];
//   // console.log(plotData, 'plotly');
//   return (
//     <Styles
//       ref={rootElem}
//       boldText={boldText}
//       headerFontSize={headerFontSize}
//       height={height}
//       width={width}
//     >
//       <h3>{headerText}</h3>
//       <Plot
//         data={[
//           {
//             z: data.z,
//             x: data.x,
//             y: data.y,
//             type: 'contour',
//             contours: {
//               coloring: 'heatmap',
//               showlabels: showLabels,
//               labelfont: {
//                 size: 12,
//                 // eslint-disable-next-line theme-colors/no-literal-colors
//                 color: 'white',
//               },
//             },
//             colorscale: colorScheme,
//             ncontours: contourLevels,
//           },
//         ]}
//         layout={{
//           width,
//           height,
//           title: headerText,
//         }}
//       />
//     </Styles>
//   );
// }

import React from 'react';
import Plot from 'react-plotly.js';
import { styled } from '@superset-ui/core';
import { SupersetPluginChartContourPlotProps } from './types';

const Styles = styled.div<{ height: number; width: number }>`
  background-color: ${({ theme }) => theme.colors.secondary.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;

  h3 {
    margin-top: 0;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    font-size: ${({ theme, headerFontSize }) =>
      theme.typography.sizes[headerFontSize]}px;
    font-weight: ${({ theme, boldText }) =>
      theme.typography.weights[boldText ? 'bold' : 'normal']};
  }
`;

const SupersetPluginChartContourPlot: React.FC<
  SupersetPluginChartContourPlotProps
> = ({
  height,
  width,
  headerText,
  boldText,
  headerFontSize,
  contourLevels,
  colorScheme,
  showLabels,
}) => {
  // Mock data for contour plot
  const mockData = {
    x: [1, 2, 3, 4, 5],
    y: [1, 2, 3, 4, 5],
    z: [
      [1, 2, 3, 4, 5],
      [2, 3, 4, 5, 6],
      [3, 4, 5, 6, 7],
      [4, 5, 6, 7, 8],
      [5, 6, 7, 8, 9],
    ],
  };

  return (
    <Styles height={height} width={width}>
      <h3>{headerText}</h3>
      <Plot
        data={[
          {
            z: mockData.z,
            x: mockData.x,
            y: mockData.y,
            type: 'contour',
            contours: {
              coloring: 'heatmap',
              showlabels: showLabels,
              labelfont: {
                size: 12,
                color: 'white',
              },
            },
            colorscale: colorScheme,
            ncontours: contourLevels,
          },
        ]}
        layout={{
          width,
          height,
          title: headerText,
        }}
      />
    </Styles>
  );
};

export default SupersetPluginChartContourPlot;
