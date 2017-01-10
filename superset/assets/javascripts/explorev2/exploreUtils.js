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
  const params = {};
  for (let i = 0; i < styles.length; i++) {
    const style = styles[i];
    params[`style_id_${i + 1}`] = style.id;
    params[`style_metric_${i + 1}`] = style.metric;
    params[`style_expr_${i + 1}`] = style.expr;
    params[`style_value_${i + 1}`] = style.value;
    params[`style_icon_${i + 1}`] = style.icon;
  }
  return params;
}

function formatBaseStyle(baseStyle) {
  const params = {};
  params.headerValue = baseStyle.headerValue;
  params.bodyValue = baseStyle.bodyValue;
  return params;
}

function formatCompares(compares) {
  const params = {};
  for (let i = 0; i < compares.length; i++) {
    const compare = compares[i];
    params[`compare_id_${i + 1}`] = compare.id;
    params[`compare_metricLeft_${i + 1}`] = compare.metricLeft;
    params[`compare_metricRight_${i + 1}`] = compare.metricRight;
    params[`compare_expr_${i + 1}`] = compare.expr;
    params[`compare_value_${i + 1}`] = compare.value;
  }
  return params;
}

function formatNavigates(navigates) {
  const params = {};
  for (let i = 0; i < navigates.length; i++) {
    const navigate = navigates[i];
    params[`navigate_id_${i + 1}`] = navigate.id;
    params[`navigate_metric_${i + 1}`] = navigate.metric;
    params[`navigate_expr_${i + 1}`] = navigate.expr;
    params[`navigate_slice_${i + 1}`] = navigate.slice;
    params[`navigate_open_${i + 1}`] = navigate.open;
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
      && field !== 'filters' && field !== 'styles' && field !== 'baseStyle'
      && field !== 'compares' && field !== 'navigates' && field !== 'slices'
      && !(saveNewSlice && field === 'slice_name')) {
      data[field] = form_data[field];
    }
  });
  const filterParams = formatFilters(form_data.filters);
  Object.assign(data, filterParams);
  const styleParams = formatStyles(form_data.styles);
  Object.assign(data, styleParams);
  const baseStyleParams = formatBaseStyle(form_data.baseStyle);
  Object.assign(data, baseStyleParams);
  const compareParams = formatCompares(form_data.compares);
  Object.assign(data, compareParams);
  const navigateParams = formatNavigates(form_data.navigates);
  Object.assign(data, navigateParams);
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
