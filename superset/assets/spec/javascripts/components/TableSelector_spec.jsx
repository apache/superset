/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import configureStore from 'redux-mock-store';
import { shallow } from 'enzyme';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';

import { table, defaultQueryEditor, initialState, tables } from '../sqllab/fixtures';
import TableSelector from '../../../src/components/TableSelector';

describe('TableSelector', () => {
  let mockedProps;
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const store = mockStore(initialState);
  let wrapper;
  let inst;

  beforeEach(() => {
    mockedProps = {
      dbId: 1,
      schema: 'main',
      onSchemaChange: sinon.stub(),
      onDbChange: sinon.stub(),
      getDbList: sinon.stub(),
      onTableChange: sinon.stub(),
      onChange: sinon.stub(),
      tableNameSticky: true,
      tableName: '',
      database: { id: 1, database_name: 'main' },
      horizontal: false,
      sqlLabMode: true,
      clearable: false,
      handleError: sinon.stub(),
    };
    wrapper = shallow(<TableSelector {...mockedProps} />, {
      context: { store },
    });
    inst = wrapper.instance();
  });

  it('is valid', () => {
    expect(React.isValidElement(<TableSelector {...mockedProps} />)).toBe(true);
  });

  describe('onDatabaseChange', () => {
    it('should fetch schemas', () => {
      sinon.stub(inst, 'fetchSchemas');
      inst.onDatabaseChange({ id: 1 });
      expect(inst.fetchSchemas.getCall(0).args[0]).toBe(1);
      inst.fetchSchemas.restore();
    });
    it('should clear tableOptions', () => {
      inst.onDatabaseChange();
      expect(wrapper.state().tableOptions).toEqual([]);
    });
  });

  describe('getTableNamesBySubStr', () => {
    const GET_TABLE_NAMES_GLOB = 'glob:*/superset/tables/1/main/*';

    afterEach(fetchMock.resetHistory);
    afterAll(fetchMock.reset);

    it('should handle empty', () =>
      inst
        .getTableNamesBySubStr('')
        .then((data) => {
          expect(data).toEqual({ options: [] });
          return Promise.resolve();
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

      wrapper
        .instance()
        .getTableNamesBySubStr('my table')
        .then((data) => {
          expect(fetchMock.calls(GET_TABLE_NAMES_GLOB)).toHaveLength(1);
          expect(data).toEqual(mockTableOptions);
          return Promise.resolve();
        });
    });

    it('should escape schema and table names', () => {
      const GET_TABLE_GLOB = 'glob:*/superset/tables/1/*/*';
      const mockTableOptions = { options: [table] };
      wrapper.setProps({ schema: 'slashed/schema' });
      fetchMock.get(GET_TABLE_GLOB, mockTableOptions, { overwriteRoutes: true });

      return wrapper
        .instance()
        .getTableNamesBySubStr('slashed/table')
        .then(() => {
          expect(fetchMock.lastUrl(GET_TABLE_GLOB))
            .toContain('/slashed%252Fschema/slashed%252Ftable');
          return Promise.resolve();
        });
    });
  });

  describe('fetchTables', () => {
    const FETCH_TABLES_GLOB = 'glob:*/superset/tables/1/main/*/*/';
    afterEach(fetchMock.resetHistory);
    afterAll(fetchMock.reset);

    it('should clear table options', () => {
      inst.fetchTables(true);
      expect(wrapper.state().tableOptions).toEqual([]);
      expect(wrapper.state().filterOptions).toBeNull();
    });

    it('should fetch table options', () => {
      fetchMock.get(FETCH_TABLES_GLOB, tables, { overwriteRoutes: true });
      inst
        .fetchTables(true, 'birth_names')
        .then(() => {
          expect(wrapper.state().tableOptions).toHaveLength(3);
          return Promise.resolve();
        });
    });

    it('should dispatch a danger toast on error', () => {
      fetchMock.get(FETCH_TABLES_GLOB, { throws: 'error' }, { overwriteRoutes: true });

      wrapper
        .instance()
        .fetchTables(true, 'birth_names')
        .then(() => {
          expect(wrapper.state().tableOptions).toEqual([]);
          expect(wrapper.state().tableOptions).toHaveLength(0);
          expect(mockedProps.handleError.callCount).toBe(1);
          return Promise.resolve();
        });
    });
  });

  describe('fetchSchemas', () => {
    const FETCH_SCHEMAS_GLOB = 'glob:*/superset/schemas/*/*/';
    afterEach(fetchMock.resetHistory);
    afterAll(fetchMock.reset);

    it('should fetch schema options', () => {
      const schemaOptions = {
        schemas: ['main', 'erf', 'superset'],
      };
      fetchMock.get(FETCH_SCHEMAS_GLOB, schemaOptions, { overwriteRoutes: true });

      wrapper
        .instance()
        .fetchSchemas(1)
        .then(() => {
          expect(fetchMock.calls(FETCH_SCHEMAS_GLOB)).toHaveLength(1);
          expect(wrapper.state().schemaOptions).toHaveLength(3);
        });
    });

    it('should dispatch a danger toast on error', () => {
      const handleErrors = sinon.stub();
      expect(handleErrors.callCount).toBe(0);
      wrapper.setProps({ handleErrors });
      fetchMock.get(FETCH_SCHEMAS_GLOB, { throws: new Error('Bad kitty') }, { overwriteRoutes: true });
      wrapper
        .instance()
        .fetchSchemas(123)
        .then(() => {
          expect(wrapper.state().schemaOptions).toEqual([]);
          expect(handleErrors.callCount).toBe(1);
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
        value: { schema: 'main', table: 'birth_names' },
        label: 'birth_names',
      });
      expect(wrapper.state().tableName).toBe('birth_names');
    });

    it('should call onTableChange with schema from table object', () => {
      wrapper.setProps({ schema: null });
      wrapper.instance().changeTable({
        value: { schema: 'other_schema', table: 'my_table' },
        label: 'other_schema.my_table',
      });
      expect(mockedProps.onTableChange.getCall(0).args[0]).toBe('my_table');
      expect(mockedProps.onTableChange.getCall(0).args[1]).toBe('other_schema');
    });
  });

  it('changeSchema', () => {
    sinon.stub(wrapper.instance(), 'fetchTables');

    wrapper.instance().changeSchema({ label: 'main', value: 'main' });
    expect(wrapper.instance().fetchTables.callCount).toBe(1);
    expect(mockedProps.onChange.callCount).toBe(1);
    wrapper.instance().changeSchema();
    expect(wrapper.instance().fetchTables.callCount).toBe(2);
    expect(mockedProps.onChange.callCount).toBe(2);

    wrapper.instance().fetchTables.restore();
  });
});
