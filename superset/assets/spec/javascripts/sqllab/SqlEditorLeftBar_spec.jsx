import React from 'react';
import configureStore from 'redux-mock-store';
import { shallow } from 'enzyme';
import sinon from 'sinon';
import thunk from 'redux-thunk';

import { table, defaultQueryEditor, initialState } from './fixtures';
import SqlEditorLeftBar from '../../../src/SqlLab/components/SqlEditorLeftBar';
import TableElement from '../../../src/SqlLab/components/TableElement';

describe('SqlEditorLeftBar', () => {
  const mockedProps = {
    actions: {
      queryEditorSetSchema: sinon.stub(),
      queryEditorSetDb: sinon.stub(),
      setDatabases: sinon.stub(),
      addTable: sinon.stub(),
      addDangerToast: sinon.stub(),
    },
    tables: [table],
    queryEditor: defaultQueryEditor,
    database: {},
    height: 0,
  };
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const store = mockStore(initialState);

  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<SqlEditorLeftBar {...mockedProps} />, {
      context: { store },
    });
  });

  it('is valid', () => {
    expect(React.isValidElement(<SqlEditorLeftBar {...mockedProps} />)).toBe(true);
  });

  it('renders a TableElement', () => {
    expect(wrapper.find(TableElement)).toHaveLength(1);
  });

});
