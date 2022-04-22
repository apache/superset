import { HandlebarsQueryFormData } from '../../src/types';
import buildQuery from '../../src/plugin/buildQuery';

describe('Handlebars buildQuery', () => {
  const formData: HandlebarsQueryFormData = {
    datasource: '5__table',
    granularitySqla: 'ds',
    groupby: ['foo'],
    viz_type: 'my_chart',
    width: '500',
    height: '500',
  };

  it('should build groupby with series in form data', () => {
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.groupby).toEqual(['foo']);
  });
});
