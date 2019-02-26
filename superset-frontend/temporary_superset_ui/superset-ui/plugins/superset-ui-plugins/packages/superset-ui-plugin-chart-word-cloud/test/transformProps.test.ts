import 'babel-polyfill';
import { ChartProps } from '@superset-ui/chart';
import transformProps from '../src/transformProps';

describe('WordCloud tranformProps', () => {
  const formData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'sum__num',
    rotation: 'square',
    series: 'name',
    sizeFrom: 10,
    sizeTo: 70,
  };
  const chartProps = new ChartProps({
    formData,
    width: 800,
    height: 600,
    payload: {
      data: [{ name: 'Hulk', sum__num: 1 }],
    },
  });

  it('should tranform chart props for word cloud viz', () => {
    expect(transformProps(chartProps)).toEqual({
      colorScheme: 'bnbColors',
      width: 800,
      height: 600,
      rotation: 'square',
      sizeRange: [10, 70],
      data: [{ size: 1, text: 'Hulk' }],
    });
  });
});
