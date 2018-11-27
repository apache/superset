import buildQuery from 'src/visualizations/wordcloud/buildQuery';

describe('WordCloud buildQuery', () => {
  const formData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    series: 'foo',
  };

  it('should build groupby with series in form data', () => {
    const queryContext = buildQuery(formData);
    const [ query ] = queryContext.queries;
    expect(query.groupby).toEqual(['foo']);
  });
});
