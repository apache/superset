import { QueryContext } from 'src/query';
import buildQuery from './buildQuery';

describe('WordCloud buildQuery', () => {
  const formData = {
    datasource: '5__table',
    groupby: ['foo'],
    series: 'bar',
  };
  let queryContext: QueryContext;

  it('should override groupby with series', () => {
    queryContext = buildQuery(formData);
    const [ query ] = queryContext.queries;
    expect(query.groupby).toEqual(['bar']);
  });
});
