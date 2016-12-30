/* eslint camelcase: 0 */
const $ = require('jquery');
function formatFilters(filters) {
  // outputs an object of url params of filters
  // prefix can be 'flt' or 'having'
  const params = {};
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];
    params[`${filter.prefix}_col_${i + 1}`] = filter.col;
    params[`${filter.prefix}_op_${i + 1}`] = filter.op;
    params[`${filter.prefix}_eq_${i + 1}`] = filter.value;
  }
  return params;
}

function formatStyles(styles) {
  let len = 0;
  if (styles !== undefined) {
    len = styles.length;
  }
  const params = {};
  for (let i = 0; i < len; i++) {
    const style = styles[i];
    params[`style_metric_${i + 1}`] = style.metric;
    params[`style_expr_${i + 1}`] = style.expr;
    params[`style_value_${i + 1}`] = style.value;
  }
  return params;
}

export function getParamObject(form_data, datasource_type, saveNewSlice) {
  const data = {
    // V2 tag temporarily for updating url
    // Todo: remove after launch
    V2: true,
    datasource_id: form_data.datasource,
    datasource_type,
  };
  Object.keys(form_data).forEach((field) => {
    // filter out null fields
    if (form_data[field] !== null && field !== 'datasource'
      && field !== 'filters' && field !== 'styles'
      && !(saveNewSlice && field === 'slice_name')) {
      data[field] = form_data[field];
    }
  });
  const filterParams = formatFilters(form_data.filters);
  Object.assign(data, filterParams);
  const styleParams = formatStyles(form_data.styles);
  Object.assign(data, styleParams);
  return data;
}

export function getExploreUrl(form_data, datasource_type, endpoint = 'base') {
  const data = getParamObject(form_data, datasource_type);
  const params = `${datasource_type}/` +
    `${form_data.datasource}/?${$.param(data, true)}`;
  switch (endpoint) {
    case 'base':
      return `/superset/explore/${params}`;
    case 'json':
      return `/superset/explore_json/${params}`;
    case 'csv':
      return `/superset/explore/${params}&csv=true`;
    case 'standalone':
      return `/superset/explore/${params}&standalone=true`;
    default:
      return `/superset/explore/${params}`;
  }
}
