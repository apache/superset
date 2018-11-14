import build, { Datasource } from 'src/query/buildDatasource';

describe('datasourceBuilder', () => {
  let datasource: Datasource;

  it('should build datasource for table sources', () => {
    datasource = build({ datasource: '5__table', granularity_sqla: 'ds'});
    expect(datasource.id).toBe(5);
    expect(datasource.type).toBe('table');
  });

  it('should build datasource for druid sources', () => {
    datasource = build({ datasource: '5__druid', granularity: 'ds'});
    expect(datasource.id).toBe(5);
    expect(datasource.type).toBe('druid');
  });
});
