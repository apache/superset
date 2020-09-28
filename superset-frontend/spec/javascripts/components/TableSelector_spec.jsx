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
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';
import thunk from 'redux-thunk';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';

import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';

import DatabaseSelector from 'src/components/DatabaseSelector';
import TableSelector from 'src/components/TableSelector';
import { initialState, tables } from '../sqllab/fixtures';

const mockStore = configureStore([thunk]);
const store = mockStore(initialState);

const FETCH_SCHEMAS_ENDPOINT = 'glob:*/api/v1/database/*/schemas/*';
const GET_TABLE_ENDPOINT = 'glob:*/superset/tables/1/*/*';
const GET_TABLE_NAMES_ENDPOINT = 'glob:*/superset/tables/1/main/*';

const mockedProps = {
  clearable: false,
  database: { id: 1, database_name: 'main' },
  dbId: 1,
  formMode: false,
  getDbList: sinon.stub(),
  handleError: sinon.stub(),
  horizontal: false,
  onChange: sinon.stub(),
  onDbChange: sinon.stub(),
  onSchemaChange: sinon.stub(),
  onTableChange: sinon.stub(),
  sqlLabMode: true,
  tableName: '',
  tableNameSticky: true,
};

const schemaOptions = {
  result: ['main', 'erf', 'superset'],
};
const selectedSchema = { label: 'main', title: 'main', value: 'main' };
const selectedTable = {
  label: 'birth_names',
  schema: 'main',
  title: 'birth_names',
  value: 'birth_names',
  type: undefined,
};

async function mountAndWait(props = mockedProps) {
  const mounted = mount(<TableSelector {...props} />, {
    context: { store },
    wrappingComponent: ThemeProvider,
    wrappingComponentProps: { theme: supersetTheme },
  });
  await waitForComponentToPaint(mounted);

  return mounted;
}

describe('TableSelector', () => {
  let wrapper;

  beforeEach(async () => {
    fetchMock.reset();
    wrapper = await mountAndWait();
  });

  it('renders', () => {
    expect(wrapper.find(TableSelector)).toExist();
    expect(wrapper.find(DatabaseSelector)).toExist();
  });

  describe('change database', () => {
    afterEach(fetchMock.resetHistory);
    afterAll(fetchMock.reset);

    it('should fetch schemas', async () => {
      fetchMock.get(FETCH_SCHEMAS_ENDPOINT, { overwriteRoutes: true });
      act(() => {
        wrapper.find('[data-test="select-database"]').first().props().onChange({
          id: 1,
          database_name: 'main',
        });
      });
      await waitForComponentToPaint(wrapper);
      expect(fetchMock.calls(FETCH_SCHEMAS_ENDPOINT)).toHaveLength(1);
    });

    it('should fetch schema options', async () => {
      fetchMock.get(FETCH_SCHEMAS_ENDPOINT, schemaOptions, {
        overwriteRoutes: true,
      });
      act(() => {
        wrapper.find('[data-test="select-database"]').first().props().onChange({
          id: 1,
          database_name: 'main',
        });
      });
      await waitForComponentToPaint(wrapper);
      wrapper.update();
      expect(fetchMock.calls(FETCH_SCHEMAS_ENDPOINT)).toHaveLength(1);

      expect(
        wrapper.find('[name="select-schema"]').first().props().options,
      ).toEqual([
        { value: 'main', label: 'main', title: 'main' },
        { value: 'erf', label: 'erf', title: 'erf' },
        { value: 'superset', label: 'superset', title: 'superset' },
      ]);
    });

    it('should clear table options', async () => {
      act(() => {
        wrapper.find('[data-test="select-database"]').first().props().onChange({
          id: 1,
          database_name: 'main',
        });
      });
      await waitForComponentToPaint(wrapper);
      const props = wrapper.find('[name="async-select-table"]').first().props();
      expect(props.isDisabled).toBe(true);
      expect(props.value).toEqual(undefined);
    });
  });

  describe('change schema', () => {
    beforeEach(async () => {
      fetchMock.get(FETCH_SCHEMAS_ENDPOINT, schemaOptions, {
        overwriteRoutes: true,
      });
    });

    afterEach(fetchMock.resetHistory);
    afterAll(fetchMock.reset);

    it('should fetch table', async () => {
      fetchMock.get(GET_TABLE_NAMES_ENDPOINT, { overwriteRoutes: true });
      act(() => {
        wrapper.find('[data-test="select-database"]').first().props().onChange({
          id: 1,
          database_name: 'main',
        });
      });
      await waitForComponentToPaint(wrapper);
      act(() => {
        wrapper
          .find('[name="select-schema"]')
          .first()
          .props()
          .onChange(selectedSchema);
      });
      await waitForComponentToPaint(wrapper);
      expect(fetchMock.calls(GET_TABLE_NAMES_ENDPOINT)).toHaveLength(1);
    });

    it('should fetch table options', async () => {
      fetchMock.get(GET_TABLE_NAMES_ENDPOINT, tables, {
        overwriteRoutes: true,
      });
      act(() => {
        wrapper.find('[data-test="select-database"]').first().props().onChange({
          id: 1,
          database_name: 'main',
        });
      });
      await waitForComponentToPaint(wrapper);
      act(() => {
        wrapper
          .find('[name="select-schema"]')
          .first()
          .props()
          .onChange(selectedSchema);
      });
      await waitForComponentToPaint(wrapper);
      expect(
        wrapper.find('[name="select-schema"]').first().props().value[0],
      ).toEqual(selectedSchema);
      expect(fetchMock.calls(GET_TABLE_NAMES_ENDPOINT)).toHaveLength(1);
      const { options } = wrapper.find('[name="select-table"]').first().props();
      expect({ options }).toEqual(tables);
    });
  });

  describe('change table', () => {
    beforeEach(async () => {
      fetchMock.get(GET_TABLE_NAMES_ENDPOINT, tables, {
        overwriteRoutes: true,
      });
    });

    it('should change table value', async () => {
      act(() => {
        wrapper
          .find('[name="select-schema"]')
          .first()
          .props()
          .onChange(selectedSchema);
      });
      await waitForComponentToPaint(wrapper);
      act(() => {
        wrapper
          .find('[name="select-table"]')
          .first()
          .props()
          .onChange(selectedTable);
      });
      await waitForComponentToPaint(wrapper);
      expect(
        wrapper.find('[name="select-table"]').first().props().value,
      ).toEqual('birth_names');
    });

    it('should call onTableChange with schema from table object', async () => {
      act(() => {
        wrapper
          .find('[name="select-schema"]')
          .first()
          .props()
          .onChange(selectedSchema);
      });
      await waitForComponentToPaint(wrapper);
      act(() => {
        wrapper
          .find('[name="select-table"]')
          .first()
          .props()
          .onChange(selectedTable);
      });
      await waitForComponentToPaint(wrapper);
      expect(mockedProps.onTableChange.getCall(0).args[0]).toBe('birth_names');
      expect(mockedProps.onTableChange.getCall(0).args[1]).toBe('main');
    });
  });

  describe('getTableNamesBySubStr', () => {
    afterEach(fetchMock.resetHistory);
    afterAll(fetchMock.reset);

    it('should handle empty', async () => {
      act(() => {
        wrapper
          .find('[name="async-select-table"]')
          .first()
          .props()
          .loadOptions();
      });
      await waitForComponentToPaint(wrapper);
      const props = wrapper.find('[name="async-select-table"]').first().props();
      expect(props.isDisabled).toBe(true);
      expect(props.value).toEqual('');
    });

    it('should handle table name', async () => {
      wrapper.setProps({ schema: 'main' });
      fetchMock.get(GET_TABLE_ENDPOINT, tables, {
        overwriteRoutes: true,
      });
      act(() => {
        wrapper
          .find('[name="async-select-table"]')
          .first()
          .props()
          .loadOptions();
      });
      await waitForComponentToPaint(wrapper);
      expect(fetchMock.calls(GET_TABLE_ENDPOINT)).toHaveLength(1);
    });
  });
});
