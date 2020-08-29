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
/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { styledShallow as shallow } from 'spec/helpers/theming';
import { OverlayTrigger } from 'react-bootstrap';

import Label from 'src/components/Label';
import AdhocFilter, {
  EXPRESSION_TYPES,
  CLAUSES,
} from 'src/explore/AdhocFilter';
import AdhocFilterOption from 'src/explore/components/AdhocFilterOption';

const simpleAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SIMPLE,
  subject: 'value',
  operator: '>',
  comparator: '10',
  clause: CLAUSES.WHERE,
});

function setup(overrides) {
  const onFilterEdit = sinon.spy();
  const props = {
    adhocFilter: simpleAdhocFilter,
    onFilterEdit,
    options: [],
    datasource: {},
    ...overrides,
  };
  const wrapper = shallow(<AdhocFilterOption {...props} />).dive();
  return { wrapper };
}

describe('AdhocFilterOption', () => {
  it('renders an overlay trigger wrapper for the label', () => {
    const { wrapper } = setup();
    const overlay = wrapper.find(OverlayTrigger);
    expect(overlay).toHaveLength(1);
    expect(overlay.props().defaultOverlayShown).toBe(false);
    expect(wrapper.find(Label)).toExist();
  });
  it('should open new filter popup by default', () => {
    const { wrapper } = setup({
      adhocFilter: simpleAdhocFilter.duplicateWith({ isNew: true }),
    });
    expect(wrapper.find(OverlayTrigger).props().defaultOverlayShown).toBe(true);
  });
});
