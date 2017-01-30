/* eslint camelcase: 0 */
function formatFilters(filters) {
  // outputs an object of url params of filters
  // prefix can be 'flt' or 'having'
  const params = {};
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];
    params[`${filter.prefix}_col_${i + 1}`] = filter.col;
    params[`${filter.prefix}_op_${i + 1}`] = filter.op;
    if (filter.value.constructor === Array) {
      params[`${filter.prefix}_eq_${i + 1}`] = filter.value.join(',');
    } else {
      params[`${filter.prefix}_eq_${i + 1}`] = filter.value;
    }
  }
  return params;
}

export function parseFilters(form_data, prefix = 'flt') {
  const filters = [];
  for (let i = 0; i <= 10; i++) {
    if (form_data[`${prefix}_col_${i}`] && form_data[`${prefix}_op_${i}`]) {
      filters.push({
        prefix,
        col: form_data[`${prefix}_col_${i}`],
        op: form_data[`${prefix}_op_${i}`],
        value: form_data[`${prefix}_eq_${i}`],
      });
    }
    /* eslint no-param-reassign: 0 */
    delete form_data[`${prefix}_col_${i}`];
    delete form_data[`${prefix}_op_${i}`];
    delete form_data[`${prefix}_eq_${i}`];
  }
  return filters;
}

export function getFilters(form_data, datasource_type) {
  if (datasource_type === 'table') {
    return parseFilters(form_data);
  }
  return parseFilters(form_data).concat(parseFilters(form_data, 'having'));
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
    if (form_data[field] !== null && field !== 'datasource' && field !== 'filters'
      && !(saveNewSlice && field === 'slice_name')) {
      data[field] = form_data[field];
    }
  });
  const filterParams = formatFilters(form_data.filters);
  Object.assign(data, filterParams);
  return data;
}

export function getExploreUrl(form_data, datasource_type, endpoint = 'base') {
  let params = `${datasource_type}/${form_data.datasource_id}/`;
  params += '?form_data=' + encodeURIComponent(JSON.stringify(form_data));
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
