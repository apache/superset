import processGroupby from '../src/processGroupby';

describe('processGroupby', () => {
  it('should handle array of strings', () => {
    expect(processGroupby(['foo', 'bar'])).toEqual(['foo', 'bar']);
  });

  it('should exclude non-string values', () => {
    // @ts-ignore, change to @ts-expect-error when updated to TypeScript>=3.9
    expect(processGroupby(['bar', 1, undefined, null, 'foo'])).toEqual(['bar', 'foo']);
  });
});
