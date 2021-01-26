import { WordCloudFormData } from '../../src';
import buildQuery from '../../src/plugin/buildQuery';

describe('WordCloud buildQuery', () => {
  const formData: WordCloudFormData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    series: 'foo',
    viz_type: 'word_cloud',
  };

  it('should build columns from series in form data', () => {
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['foo']);
  });
});
