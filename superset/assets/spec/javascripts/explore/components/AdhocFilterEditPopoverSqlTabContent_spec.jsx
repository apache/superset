/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';
import { FormGroup } from 'react-bootstrap';

import AdhocFilter, { EXPRESSION_TYPES, CLAUSES } from '../../../../src/explore/AdhocFilter';
import AdhocFilterEditPopoverSqlTabContent from '../../../../src/explore/components/AdhocFilterEditPopoverSqlTabContent';

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
    expect(wrapper.find(FormGroup)).toHaveLength(2);
  });

  it('passes the new clause to onChange after onSqlExpressionClauseChange', () => {
    const { wrapper, onChange } = setup();
    wrapper.instance().onSqlExpressionClauseChange(CLAUSES.HAVING);
    expect(onChange.calledOnce).toBe(true);
    expect(onChange.lastCall.args[0].equals((
      sqlAdhocFilter.duplicateWith({ clause: CLAUSES.HAVING })
    ))).toBe(true);
  });

  it('passes the new query to onChange after onSqlExpressionChange', () => {
    const { wrapper, onChange } = setup();
    wrapper.instance().onSqlExpressionChange('value < 5');
    expect(onChange.calledOnce).toBe(true);
    expect(onChange.lastCall.args[0].equals((
      sqlAdhocFilter.duplicateWith({ sqlExpression: 'value < 5' })
    ))).toBe(true);
  });
});
