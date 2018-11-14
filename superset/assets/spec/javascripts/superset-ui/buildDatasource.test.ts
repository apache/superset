import build from 'src/query/buildDatasource';

describe('datasourceBuilder', () => {

  it('should build datasource for table sources', () => {
    const datasource = build({ datasource: '5__table', granularity_sqla: 'ds'});
    expect(datasource.id).toBe(5);
    expect(datasource.type).toBe('table');
  });

  it('should build datasource for druid sources', () => {
    const datasource = build({ datasource: '5__druid', granularity: 'ds'});
    expect(datasource.id).toBe(5);
    expect(datasource.type).toBe('druid');
  });
});
