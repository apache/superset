/* eslint camelcase: 0 */
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
      && !(saveNewSlice && field === 'slice_name')) {
      data[field] = form_data[field];
    }
  });
  const filterParams = formatFilters(form_data.filters);
  Object.assign(data, filterParams);
  return data;
}
