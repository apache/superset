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
import { shallow } from 'enzyme';

import AdhocFilter, {
  EXPRESSION_TYPES,
  CLAUSES,
} from 'src/explore/components/controls/FilterControl/AdhocFilter';
import AdhocFilterEditPopoverSqlTabContent from '.';

const sqlAdhocFilter = new AdhocFilter({
  expressionType: EXPRESSION_TYPES.SQL,
  sqlExpression: 'value > 10',
  clause: CLAUSES.WHERE,
});

function setup(overrides) {
  const onChange = sinon.spy();
  const props = {
    adhocFilter: sqlAdhocFilter,
    onChange,
    options: [],
    height: 100,
    ...overrides,
  };
  const wrapper = shallow(<AdhocFilterEditPopoverSqlTabContent {...props} />);
  return { wrapper, onChange };
}

describe('AdhocFilterEditPopoverSqlTabContent', () => {
  it('renders the sql tab form', () => {
    const { wrapper } = setup();
    expect(wrapper).toExist();
  });

  it('passes the new clause to onChange after onSqlExpressionClauseChange', () => {
    const { wrapper, onChange } = setup();
    wrapper.instance().onSqlExpressionClauseChange(CLAUSES.HAVING);
    expect(onChange.calledOnce).toBe(true);
    expect(
      onChange.lastCall.args[0].equals(
        sqlAdhocFilter.duplicateWith({ clause: CLAUSES.HAVING }),
      ),
    ).toBe(true);
  });

  it('passes the new query to onChange after onSqlExpressionChange', () => {
    const { wrapper, onChange } = setup();
    wrapper.instance().onSqlExpressionChange('value < 5');
    expect(onChange.calledOnce).toBe(true);
    expect(
      onChange.lastCall.args[0].equals(
        sqlAdhocFilter.duplicateWith({ sqlExpression: 'value < 5' }),
      ),
    ).toBe(true);
  });
});
