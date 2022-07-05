import buildQuery from '../../src/plugin/buildQuery';
import { CccsGridQueryFormData } from '../../src/types';

describe('CccsGrid buildQuery', () => {
  const formData: CccsGridQueryFormData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    series: 'foo',
    emitFilter: false,
    include_search: false,
    page_length: 0,
    enable_grouping: false,
    viz_type: 'my_chart',
    column_state: [],
  };

  it('should build groupby with series in form data', () => {
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.groupby).toEqual(['foo']);
  });
});
