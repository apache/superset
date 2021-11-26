import 'babel-polyfill';
import { ChartProps } from '@superset-ui/chart';
import transformProps from '../../src/legacy/transformProps';

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
    queryData: {
      data: [{ name: 'Hulk', sum__num: 1 }],
    },
  });

  it('should tranform chart props for word cloud viz', () => {
    expect(transformProps(chartProps)).toEqual({
      width: 800,
      height: 600,
      encoding: {
        color: {
          field: 'name',
          scale: {
            scheme: 'bnbColors',
          },
          type: 'nominal',
        },
        fontSize: {
          field: 'sum__num',
          scale: {
            range: [0, 70],
            zero: true,
          },
          type: 'quantitative',
        },
        text: {
          field: 'name',
        },
      },
      rotation: 'square',
      data: [{ name: 'Hulk', sum__num: 1 }],
    });
  });
});
