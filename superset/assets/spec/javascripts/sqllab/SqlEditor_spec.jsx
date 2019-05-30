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
import { shallow } from 'enzyme';

import { defaultQueryEditor, initialState, queries, table } from './fixtures';
import {
  SQL_EDITOR_GUTTER_HEIGHT,
  SQL_EDITOR_GUTTER_MARGIN,
  SQL_TOOLBAR_HEIGHT,
} from '../../../src/SqlLab/constants';
import AceEditorWrapper from '../../../src/SqlLab/components/AceEditorWrapper';
import LimitControl from '../../../src/SqlLab/components/LimitControl';
import SouthPane from '../../../src/SqlLab/components/SouthPane';
import SqlEditor from '../../../src/SqlLab/components/SqlEditor';
import SqlEditorLeftBar from '../../../src/SqlLab/components/SqlEditorLeftBar';

const MOCKED_SQL_EDITOR_HEIGHT = 500;

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

  beforeAll(() => {
    jest.spyOn(SqlEditor.prototype, 'getSqlEditorHeight').mockImplementation(() => MOCKED_SQL_EDITOR_HEIGHT);
  });

  it('is valid', () => {
    expect(
      React.isValidElement(<SqlEditor {...mockedProps} />),
    ).toBe(true);
  });
  it('render a SqlEditorLeftBar', () => {
    const wrapper = shallow(<SqlEditor {...mockedProps} />);
    expect(wrapper.find(SqlEditorLeftBar)).toHaveLength(1);
  });
  it('render an AceEditorWrapper', () => {
    const wrapper = shallow(<SqlEditor {...mockedProps} />);
    expect(wrapper.find(AceEditorWrapper)).toHaveLength(1);
  });
  it('render an SouthPane', () => {
    const wrapper = shallow(<SqlEditor {...mockedProps} />);
    expect(wrapper.find(SouthPane)).toHaveLength(1);
  });
  it('does not overflow the editor window', () => {
    const wrapper = shallow(<SqlEditor {...mockedProps} />);
    const totalSize = parseFloat(wrapper.find(AceEditorWrapper).props().height)
      + wrapper.find(SouthPane).props().height
      + SQL_TOOLBAR_HEIGHT
      + (SQL_EDITOR_GUTTER_MARGIN * 2)
      + SQL_EDITOR_GUTTER_HEIGHT;
    expect(totalSize).toEqual(MOCKED_SQL_EDITOR_HEIGHT);
  });
  it('does not overflow the editor window after resizing', () => {
    const wrapper = shallow(<SqlEditor {...mockedProps} />);
    wrapper.setState({ height: 450 });
    const totalSize = parseFloat(wrapper.find(AceEditorWrapper).props().height)
      + wrapper.find(SouthPane).props().height
      + SQL_TOOLBAR_HEIGHT
      + (SQL_EDITOR_GUTTER_MARGIN * 2)
      + SQL_EDITOR_GUTTER_HEIGHT;
    expect(totalSize).toEqual(450);
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
