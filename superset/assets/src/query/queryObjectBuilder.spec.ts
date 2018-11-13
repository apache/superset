import build, { QueryObject } from './queryObjectBuilder';

describe('queryObjectBuilder', () => {
  const formData = {
    datasource: '5__table',
    groupby: ['foo', 'bar'],
  };
  let query: QueryObject;

  it('should build groupby when its value is present', () => {
    [ query ] = build(formData);
    expect(query.groupby).toEqual(['foo', 'bar']);
  });

  it('should build an empty groupby when its value is not present', () => {
    [ query ] = build({
      ...formData,
      groupby: undefined,
    });
    expect(query.groupby).toEqual([]);
  });
});
