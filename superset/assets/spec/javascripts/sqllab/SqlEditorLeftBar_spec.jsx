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
    expect(React.isValidElement(<SqlEditorLeftBar {...mockedProps} />)).toBe(
      true,
    );
  });

  it('renders a TableElement', () => {
    expect(wrapper.find(TableElement)).toHaveLength(1);
  });
});
