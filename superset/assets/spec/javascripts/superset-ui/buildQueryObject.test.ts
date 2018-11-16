import build from 'src/query/buildQueryObject';

describe('queryObjectBuilder', () => {
  it('should build granularity for sql alchemy datasources', () => {
    const query = build({datasource: '5__table', granularity_sqla: 'ds'});
    expect(query.granularity).toEqual('ds');
  });

  it('should build granularity for sql alchemy datasources', () => {
    const query = build({datasource: '5__druid', granularity: 'ds'});
    expect(query.granularity).toEqual('ds');
  });
});
