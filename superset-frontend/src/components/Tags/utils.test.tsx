import { tagToSelectOption } from 'src/components/Tags/utils';

describe('tagToSelectOption', () => {
  test('converts a Tag object with table_name to a SelectTagsValue', () => {
    const tag = {
      id: '1',
      name: 'TagName',
      table_name: 'Table1',
    };

    const expectedSelectTagsValue = {
      value: 'TagName',
      label: 'TagName',
      key: '1',
    };

    expect(tagToSelectOption(tag)).toEqual(expectedSelectTagsValue);
  });

  test('handles tags with undefined properties', () => {
    const tag = {
      id: undefined,
      name: undefined,
      table_name: 'Table1',
    };

    const expectedSelectTagsValue = {
      value: undefined,
      label: undefined,
      key: undefined,
    };

    expect(tagToSelectOption(tag)).toEqual(expectedSelectTagsValue);
  });
});
