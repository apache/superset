import React from 'react';
import { shallow } from 'enzyme';

import { defaultQueryEditor, initialState, queries, table } from './fixtures';
import LimitControl from '../../../src/SqlLab/components/LimitControl';
import SqlEditor from '../../../src/SqlLab/components/SqlEditor';
import SqlEditorLeftBar from '../../../src/SqlLab/components/SqlEditorLeftBar';

describe('SqlEditor', () => {
  const mockedProps = {
    actions: {},
    database: {},
    queryEditor: initialState.sqlLab.queryEditors[0],
    latestQuery: queries[0],
    tables: [table],
    queries,
    getHeight: () => ('100px'),
    editorQueries: [],
    dataPreviewQueries: [],
    defaultQueryLimit: 1000,
    maxRow: 100000,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<SqlEditor {...mockedProps} />),
    ).toBe(true);
  });
  it('render a SqlEditorLeftBar', () => {
    const wrapper = shallow(<SqlEditor {...mockedProps} />);
    expect(wrapper.find(SqlEditorLeftBar)).toHaveLength(1);
  });
  it('render a LimitControl with default limit', () => {
    const defaultQueryLimit = 101;
    const updatedProps = { ...mockedProps, defaultQueryLimit };
    const wrapper = shallow(<SqlEditor {...updatedProps} />);
    expect(wrapper.find(LimitControl)).toHaveLength(1);
    expect(wrapper.find(LimitControl).props().value).toEqual(defaultQueryLimit);
  });
  it('render a LimitControl with existing limit', () => {
    const queryEditor = { ...defaultQueryEditor, queryLimit: 101 };
    const updatedProps = { ...mockedProps, queryEditor };
    const wrapper = shallow(<SqlEditor {...updatedProps} />);
    expect(wrapper.find(LimitControl)).toHaveLength(1);
    expect(wrapper.find(LimitControl).props().value).toEqual(queryEditor.queryLimit);
  });
});
