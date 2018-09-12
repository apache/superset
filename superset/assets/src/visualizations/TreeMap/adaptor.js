import treemap from './treemap';

function buildHiarachey(data, metric, groupby, level) {
  if (level === groupby.length - 1) {
    return data.map(d => ({
      name: d[groupby[level]],
      value: d[metric],
    }));
  }
  const keySet = new Set(data.map(d => d[groupby[level]]));
  return [...keySet].map(key => ({
    name: key,
    children: buildHiarachey(
      data.filter(d => d[groupby[level]] === key),
      metric,
      groupby,
      level + 1,
    ),
  }));
}

function getNestedStructure(data, metric, groupby) {
  const chartData = {
    name: metric,
    children: buildHiarachey(data, metric, groupby, 0),
  };
  return chartData;
}

function transform(data, formData) {
  const { groupby, metrics } = formData;
  return metrics.map(metric => getNestedStructure(data, metric.label || metric, groupby));
}

function adaptor(slice, payload) {
  const { selector, formData } = slice;
  const {
    number_format: numberFormat,
    color_scheme: colorScheme,
    treemap_ratio: treemapRatio,
  } = formData;
  const element = document.querySelector(selector);
  const transformedData = transform(payload.data, formData);

  return treemap(element, {
    data: transformedData,
    width: slice.width(),
    height: slice.height(),
    numberFormat,
    colorScheme,
    treemapRatio,
  });
}

export default adaptor;
