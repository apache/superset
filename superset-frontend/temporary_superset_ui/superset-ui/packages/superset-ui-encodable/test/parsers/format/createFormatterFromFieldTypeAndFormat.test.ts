import createFormatterFromFieldTypeAndFormat from '../../../src/parsers/format/createFormatterFromFieldTypeAndFormat';

describe('createFormatterFromFieldTypeAndFormat(type, format)', () => {
  it('handles quantitative field type', () => {
    const formatter = createFormatterFromFieldTypeAndFormat('quantitative', '.2f');
    expect(formatter(200)).toEqual('200.00');
  });
  it('handles temporal field type', () => {
    const formatter = createFormatterFromFieldTypeAndFormat('temporal', '%b %d, %Y');
    expect(formatter(new Date(Date.UTC(2019, 5, 20)))).toEqual('Jun 20, 2019');
  });
  it('uses fallback for other cases', () => {
    const formatter = createFormatterFromFieldTypeAndFormat('nominal', '');
    expect(formatter('cat')).toEqual('cat');
  });
});
