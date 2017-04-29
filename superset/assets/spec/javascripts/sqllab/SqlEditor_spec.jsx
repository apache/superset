import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import { initialState, queries, table } from './fixtures';
import SqlEditor from '../../../javascripts/SqlLab/components/SqlEditor';
import SqlEditorLeftBar from '../../../javascripts/SqlLab/components/SqlEditorLeftBar';

describe('SqlEditor', () => {
  const mockedProps = {
    actions: {},
    database: {},
    queryEditor: initialState.queryEditors[0],
    latestQuery: queries[0],
    tables: [table],
    queries,
    height: '',
    editorQueries: [],
    dataPreviewQueries: [],
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<SqlEditor {...mockedProps} />),
    ).to.equal(true);
  });
  it('render a SqlEditorLeftBar', () => {
    const wrapper = shallow(<SqlEditor {...mockedProps} />);
    expect(wrapper.find(SqlEditorLeftBar)).to.have.length(1);
  });
});
