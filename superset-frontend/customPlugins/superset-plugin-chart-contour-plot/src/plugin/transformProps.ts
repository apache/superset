import { ChartProps } from '@superset-ui/core';

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, queryData } = chartProps;
  const { x_axis_column, y_axis_column, z_axis_column } = formData;

  // Debugging: Log the incoming data
  // console.log('transformProps - queryData:', queryData);
  // console.log('transformProps - formData:', formData);

  // Ensure queryData and data are properly defined
  const data = queryData?.data;

  // Handle the case where data is undefined
  if (!data) {
    console.warn('No data available in queryData');
    return {
      width,
      height,
      data: [], // Return an empty array to handle gracefully in the visualization
    };
  }

  // Handle the case where query is empty
  if (data.length === 0) {
    console.warn('Query returned no data');
    return {
      width,
      height,
      data: [],
    };
  }

  const formattedData = [
    {
      // z: data.map(d => d.z),
      // x: data.map(d => d.x),
      // y: data.map(d => d.y),
      // type: 'contour',
      z: [
        [10, 10.625, 12.5, 15.625, 20],
        [5.625, 6.25, 8.125, 11.25, 15.625],
        [2.5, 3.125, 5, 8.125, 12.5],
        [0.625, 1.25, 3.125, 6.25, 10.625],
        [0, 0.625, 2.5, 5.625, 10],
      ],
      x: [-9, -6, -5, -3, -1],
      y: [0, 1, 4, 5, 7],
    },
  ];

  // const formattedData = data.map((d: { [x: string]: any }) => ({
  //   x: d[x_axis_column],
  //   y: d[y_axis_column],
  //   z: d[z_axis_column],
  // }));

  return {
    width,
    height,
    data: formattedData,
    headerText: formData.header_text,
    boldText: formData.bold_text,
    headerFontSize: formData.header_font_size,
    contourLevels: formData.contour_levels,
    colorScheme: formData.color_scheme,
    showLabels: formData.show_labels,
  };
}
