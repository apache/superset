import { pick } from 'lodash';
import { ChartProps } from '@superset-ui/chart';
import { BoxPlotDataRow, RawBoxPlotDataRow } from '../components/BoxPlot/types';
import { HookProps } from '../components/BoxPlot/BoxPlot';
import { BoxPlotEncoding } from '../components/BoxPlot/Encoder';

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, queryData } = chartProps;
  const { margin, theme } = formData;
  const encoding = formData.encoding as BoxPlotEncoding;

  const data = (queryData.data as RawBoxPlotDataRow[]).map(({ label, values }) => ({
    label,
    min: values.whisker_low,
    max: values.whisker_high,
    firstQuartile: values.Q1,
    median: values.Q2,
    thirdQuartile: values.Q3,
    outliers: values.outliers,
  }));

  const isHorizontal = encoding.y.type === 'nominal';

  const boxPlotValues = data.reduce((r: number[], e: BoxPlotDataRow) => {
    r.push(e.min, e.max, ...e.outliers);

    return r;
  }, []);

  const minBoxPlotValue = Math.min(...boxPlotValues);
  const maxBoxPlotValue = Math.max(...boxPlotValues);
  const valueDomain = [
    minBoxPlotValue - 0.1 * Math.abs(minBoxPlotValue),
    maxBoxPlotValue + 0.1 * Math.abs(maxBoxPlotValue),
  ];

  if (isHorizontal) {
    if (encoding.x.scale) {
      encoding.x.scale.domain = valueDomain;
    } else {
      encoding.x.scale = { domain: valueDomain };
    }
  } else if (encoding.y.scale) {
    encoding.y.scale.domain = valueDomain;
  } else {
    encoding.y.scale = { domain: valueDomain };
  }

  const hooks = chartProps.hooks as HookProps;

  const fieldsFromHooks: (keyof HookProps)[] = [
    'TooltipRenderer',
    'LegendRenderer',
    'LegendGroupRenderer',
    'LegendItemRenderer',
    'LegendItemMarkRenderer',
    'LegendItemLabelRenderer',
  ];

  return {
    data,
    width,
    height,
    margin,
    theme,
    encoding,
    ...pick(hooks, fieldsFromHooks),
  };
}
