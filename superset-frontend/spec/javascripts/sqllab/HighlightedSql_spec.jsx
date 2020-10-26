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
import SyntaxHighlighter from 'react-syntax-highlighter';
import { mount, shallow } from 'enzyme';

import HighlightedSql from 'src/SqlLab/components/HighlightedSql';
import ModalTrigger from 'src/components/ModalTrigger';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';

describe('HighlightedSql', () => {
  const sql =
    "SELECT * FROM test WHERE something='fkldasjfklajdslfkjadlskfjkldasjfkladsjfkdjsa'";
  it('renders with props', () => {
    expect(React.isValidElement(<HighlightedSql sql={sql} />)).toBe(true);
  });
  it('renders a ModalTrigger', () => {
    const wrapper = shallow(<HighlightedSql sql={sql} />);
    expect(wrapper.find(ModalTrigger)).toExist();
  });
  it('renders a ModalTrigger while using shrink', () => {
    const wrapper = shallow(<HighlightedSql sql={sql} shrink maxWidth={20} />);
    expect(wrapper.find(ModalTrigger)).toExist();
  });
  it('renders two SyntaxHighlighter in modal', () => {
    const wrapper = mount(
      <HighlightedSql
        sql={sql}
        rawSql="SELECT * FORM foo"
        shrink
        maxWidth={5}
      />,
      {
        wrappingComponent: ThemeProvider,
        wrappingComponentProps: {
          theme: supersetTheme,
        },
      },
    );
    const pre = wrapper.find('pre');
    expect(pre).toHaveLength(1);
    pre.simulate('click');
    setTimeout(() => {
      const modalBody = mount(wrapper.state().modalBody);
      expect(modalBody.find(SyntaxHighlighter)).toHaveLength(2);
    }, 10);
  });
});
