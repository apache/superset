import extractGetter from '../../../src/encodeable/parsers/extractGetter';

describe('extractGetter', () => {
  it('extract getter from ValueDef { value: "abc" }', () => {
    const getter = extractGetter({ value: 'abc' });
    expect(getter(undefined)).toEqual('abc');
  });

  it('extract getter from FieldDef { field: "fieldName" }', () => {
    const getter = extractGetter({ field: 'age' });
    expect(getter({ age: 10 })).toEqual(10);
  });
});
