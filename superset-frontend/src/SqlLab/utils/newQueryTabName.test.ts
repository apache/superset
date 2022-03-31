import { newQueryTabName } from './newQueryTabName';

const emptyEditor = {
  title: '',
  schema: '',
  autorun: false,
  sql: '',
  remoteId: null,
};

describe('newQueryTabName', () => {
  it("should return default title if queryEditor's length is 0", () => {
    const defaultTitle = 'default title';
    const title = newQueryTabName([], defaultTitle);
    expect(title).toEqual(defaultTitle);
  });
  it('should return next available number if there are unsaved editors', () => {
    const untitledQueryText = 'Untitled Query';
    const unsavedEditors = [
      { ...emptyEditor, title: `${untitledQueryText} 1` },
      { ...emptyEditor, title: `${untitledQueryText} 2` },
    ];

    const nextTitle = newQueryTabName(unsavedEditors);
    expect(nextTitle).toEqual(`${untitledQueryText} 3`);
  });
});
