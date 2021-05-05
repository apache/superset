import { FormData } from './types';

const defaultDataColorMapper = `
function dataColorMapper(data) {
  if (data['count'] < 10){
    return '#ED1C24';
  }
  else {
    return '#0BDA51';
  }
}
`;

const defaultMarkdown = `
Count
=====

{{count}}
`;

export const DEFAULT_FORM_DATA: FormData = {
  adhoc_filters: [],
  data_color_mapper: defaultDataColorMapper,
  datasource: '',
  groupby: [],
  markdown: defaultMarkdown,
  metrics: [],
  number_format: 'SMART_NUMBER',
  order_desc: true,
  orientation: 'horizontal',
  rounded_corners: true,
  text_color: 'dark',
  viz_type: '',
};
