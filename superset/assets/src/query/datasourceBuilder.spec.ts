import build, { Datasource } from './datasourceBuilder';

describe('datasourceBuilder', () => {
  let datasource: Datasource;

  it('should build datasource for table sources', () => {
    datasource = build({ datasource: '5__table'});
    expect(datasource.id).toBe(5);
    expect(datasource.type).toBe('table');
  });

  it('should build datasource for druid sources', () => {
    datasource = build({ datasource: '5__druid'});
    expect(datasource.id).toBe(5);
    expect(datasource.type).toBe('druid');
  });
});
