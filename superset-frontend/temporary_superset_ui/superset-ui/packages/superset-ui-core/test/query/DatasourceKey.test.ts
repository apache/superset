import { DatasourceKey } from '@superset-ui/core/src/query';

describe('DatasourceKey', () => {
  const tableKey = '5__table';
  const druidKey = '5__druid';

  it('should handle table data sources', () => {
    const datasourceKey = new DatasourceKey(tableKey);
    expect(datasourceKey.toString()).toBe(tableKey);
    expect(datasourceKey.toObject()).toEqual({ id: 5, type: 'table' });
  });

  it('should handle druid data sources', () => {
    const datasourceKey = new DatasourceKey(druidKey);
    expect(datasourceKey.toString()).toBe(druidKey);
    expect(datasourceKey.toObject()).toEqual({ id: 5, type: 'druid' });
  });
});
