import treemap from './treemap';

function getNestedStructure(data, metric, groupby) {
  console.log(data);
}

function transform(data, formData) {
  console.log(data);
  const { groupby, metrics } = formData;
  return metrics.map(metric => getNestedStructure(data, metric, groupby));
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
