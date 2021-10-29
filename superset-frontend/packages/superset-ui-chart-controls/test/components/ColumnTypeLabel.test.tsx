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
import { GenericDataType } from '@superset-ui/core';

import { ColumnTypeLabel, ColumnTypeLabelProps } from '../../src';

describe('ColumnOption', () => {
  const defaultProps = {
    type: GenericDataType.STRING,
  };

  const props = { ...defaultProps };

  function getWrapper(overrides: Partial<ColumnTypeLabelProps>) {
    const wrapper = shallow(<ColumnTypeLabel {...props} {...overrides} />);
    return wrapper;
  }

  it('is a valid element', () => {
    expect(React.isValidElement(<ColumnTypeLabel {...defaultProps} />)).toBe(true);
  });
  it('string type shows ABC icon', () => {
    const lbl = getWrapper({ type: GenericDataType.STRING }).find('.type-label');
    expect(lbl).toHaveLength(1);
    expect(lbl.first().text()).toBe('ABC');
  });
  it('int type shows # icon', () => {
    const lbl = getWrapper({ type: GenericDataType.NUMERIC }).find('.type-label');
    expect(lbl).toHaveLength(1);
    expect(lbl.first().text()).toBe('#');
  });
  it('bool type shows T/F icon', () => {
    const lbl = getWrapper({ type: GenericDataType.BOOLEAN }).find('.type-label');
    expect(lbl).toHaveLength(1);
    expect(lbl.first().text()).toBe('T/F');
  });
  it('expression type shows function icon', () => {
    const lbl = getWrapper({ type: 'expression' }).find('.type-label');
    expect(lbl).toHaveLength(1);
    expect(lbl.first().text()).toBe('ƒ');
  });
  it('unknown type shows question mark', () => {
    const lbl = getWrapper({ type: undefined }).find('.type-label');
    expect(lbl).toHaveLength(1);
    expect(lbl.first().text()).toBe('?');
  });
  it('datetime type displays', () => {
    const lbl = getWrapper({ type: GenericDataType.TEMPORAL }).find('.fa-clock-o');
    expect(lbl).toHaveLength(1);
  });
});
