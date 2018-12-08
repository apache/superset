import React from 'react';
import configureStore from 'redux-mock-store';
import { shallow } from 'enzyme';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';

import { table, defaultQueryEditor, databases, initialState, tables } from './fixtures';
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
    }).dive();
  });

  it('is valid', () => {
    expect(React.isValidElement(<SqlEditorLeftBar {...mockedProps} />)).toBe(true);
  });

  it('renders a TableElement', () => {
    expect(wrapper.find(TableElement)).toHaveLength(1);
  });

  describe('onDatabaseChange', () => {
    it('should fetch schemas', () => {
      sinon.stub(wrapper.instance(), 'fetchSchemas');
      wrapper.instance().onDatabaseChange({ value: 1, label: 'main' });
      expect(wrapper.instance().fetchSchemas.getCall(0).args[0]).toBe(1);
      wrapper.instance().fetchSchemas.restore();
    });
    it('should clear tableOptions', () => {
      wrapper.instance().onDatabaseChange();
      expect(wrapper.state().tableOptions).toEqual([]);
    });
  });

  describe('getTableNamesBySubStr', () => {
    const GET_TABLE_NAMES_GLOB = 'glob:*/superset/tables/1/main/*';

    afterEach(fetchMock.resetHistory);
    afterAll(fetchMock.reset);

    it('should handle empty', () =>
      wrapper
        .instance()
        .getTableNamesBySubStr('')
        .then((data) => {
          expect(data).toEqual({ options: [] });
        }));

    it('should handle table name', () => {
      const queryEditor = {
        ...defaultQueryEditor,
        dbId: 1,
        schema: 'main',
      };

      const mockTableOptions = { options: [table] };
      wrapper.setProps({ queryEditor });
      fetchMock.get(GET_TABLE_NAMES_GLOB, mockTableOptions, { overwriteRoutes: true });

      return wrapper
        .instance()
        .getTableNamesBySubStr('my table')
        .then((data) => {
          expect(fetchMock.calls(GET_TABLE_NAMES_GLOB)).toHaveLength(1);
          expect(data).toEqual(mockTableOptions);
        });
    });
  });

  it('dbMutator should build databases options', () => {
    const options = wrapper.instance().dbMutator(databases);
    expect(options).toEqual([
      { value: 1, label: 'main' },
      { value: 208, label: 'Presto - Gold' },
    ]);
  });

  describe('fetchTables', () => {
    const FETCH_TABLES_GLOB = 'glob:*/superset/tables/1/main/birth_names/true/';
    afterEach(fetchMock.resetHistory);
    afterAll(fetchMock.reset);

    it('should clear table options', () => {
      wrapper.instance().fetchTables(1);
      expect(wrapper.state().tableOptions).toEqual([]);
      expect(wrapper.state().filterOptions).toBeNull();
    });

    it('should fetch table options', () => {
      expect.assertions(2);
      fetchMock.get(FETCH_TABLES_GLOB, tables, { overwriteRoutes: true });

      return wrapper
        .instance()
        .fetchTables(1, 'main', true, 'birth_names')
        .then(() => {
          expect(fetchMock.calls(FETCH_TABLES_GLOB)).toHaveLength(1);
          expect(wrapper.state().tableLength).toBe(3);
        });
    });

    it('should dispatch a danger toast on error', () => {
      const dangerToastSpy = sinon.spy();

      wrapper.setProps({
        actions: {
          addDangerToast: dangerToastSpy,
        },
      });

      expect.assertions(4);
      fetchMock.get(FETCH_TABLES_GLOB, { throws: 'error' }, { overwriteRoutes: true });

      return wrapper
        .instance()
        .fetchTables(1, 'main', true, 'birth_names')
        .then(() => {
          expect(fetchMock.calls(FETCH_TABLES_GLOB)).toHaveLength(1);
          expect(wrapper.state().tableOptions).toEqual([]);
          expect(wrapper.state().tableLength).toBe(0);
          expect(dangerToastSpy.callCount).toBe(1);
        });
    });
  });

  describe('fetchSchemas', () => {
    const FETCH_SCHEMAS_GLOB = 'glob:*/superset/schemas/*';
    afterEach(fetchMock.resetHistory);
    afterAll(fetchMock.reset);

    it('should fetch schema options', () => {
      expect.assertions(2);
      const schemaOptions = {
        schemas: ['main', 'erf', 'superset'],
      };
      fetchMock.get(FETCH_SCHEMAS_GLOB, schemaOptions, { overwriteRoutes: true });

      return wrapper
        .instance()
        .fetchSchemas(1)
        .then(() => {
          expect(fetchMock.calls(FETCH_SCHEMAS_GLOB)).toHaveLength(1);
          expect(wrapper.state().schemaOptions).toHaveLength(3);
        });
    });

    it('should dispatch a danger toast on error', () => {
      const dangerToastSpy = sinon.spy();

      wrapper.setProps({
        actions: {
          addDangerToast: dangerToastSpy,
        },
      });

      expect.assertions(3);

      fetchMock.get(FETCH_SCHEMAS_GLOB, { throws: 'error' }, { overwriteRoutes: true });

      return wrapper
        .instance()
        .fetchSchemas(123)
        .then(() => {
          expect(fetchMock.calls(FETCH_SCHEMAS_GLOB)).toHaveLength(1);
          expect(wrapper.state().schemaOptions).toEqual([]);
          expect(dangerToastSpy.callCount).toBe(1);
        });
    });
  });

  describe('changeTable', () => {
    beforeEach(() => {
      sinon.stub(wrapper.instance(), 'fetchTables');
    });

    afterEach(() => {
      wrapper.instance().fetchTables.restore();
    });

    it('test 1', () => {
      wrapper.instance().changeTable({
        value: 'birth_names',
        label: 'birth_names',
      });
      expect(wrapper.state().tableName).toBe('birth_names');
    });

    it('test 2', () => {
      wrapper.instance().changeTable({
        value: 'main.my_table',
        label: 'my_table',
      });
      expect(wrapper.instance().fetchTables.getCall(0).args[1]).toBe('main');
    });
  });

  it('changeSchema', () => {
    sinon.stub(wrapper.instance(), 'fetchTables');

    wrapper.instance().changeSchema({ label: 'main', value: 'main' });
    expect(wrapper.instance().fetchTables.getCall(0).args[1]).toBe('main');
    wrapper.instance().changeSchema();
    expect(wrapper.instance().fetchTables.getCall(1).args[1]).toBeNull();

    wrapper.instance().fetchTables.restore();
  });
});
