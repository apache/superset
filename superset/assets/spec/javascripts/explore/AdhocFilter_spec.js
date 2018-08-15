import { expect } from 'chai';
import { describe, it } from 'mocha';

import AdhocFilter, { EXPRESSION_TYPES, CLAUSES } from '../../../src/explore/AdhocFilter';

describe('AdhocFilter', () => {
  it('sets filterOptionName in constructor', () => {
    const adhocFilter = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: CLAUSES.WHERE,
    });
    expect(adhocFilter.filterOptionName.length).to.be.above(10);
    expect(adhocFilter).to.deep.equal({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: CLAUSES.WHERE,
      filterOptionName: adhocFilter.filterOptionName,
      sqlExpression: null,
      fromFormData: false,
    });
  });

  it('can create altered duplicates', () => {
    const adhocFilter1 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: CLAUSES.WHERE,
    });
    const adhocFilter2 = adhocFilter1.duplicateWith({ operator: '<' });

    expect(adhocFilter1.subject).to.equal(adhocFilter2.subject);
    expect(adhocFilter1.comparator).to.equal(adhocFilter2.comparator);
    expect(adhocFilter1.clause).to.equal(adhocFilter2.clause);
    expect(adhocFilter1.expressionType).to.equal(adhocFilter2.expressionType);

    expect(adhocFilter1.operator).to.equal('>');
    expect(adhocFilter2.operator).to.equal('<');
  });

  it('can verify equality', () => {
    const adhocFilter1 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: CLAUSES.WHERE,
    });
    const adhocFilter2 = adhocFilter1.duplicateWith({});

    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter1.equals(adhocFilter2)).to.be.true;
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter1 === adhocFilter2).to.be.false;
  });

  it('can verify inequality', () => {
    const adhocFilter1 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: CLAUSES.WHERE,
    });
    const adhocFilter2 = adhocFilter1.duplicateWith({ operator: '<' });

    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter1.equals(adhocFilter2)).to.be.false;

    const adhocFilter3 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'value > 10',
      clause: CLAUSES.WHERE,
    });
    const adhocFilter4 = adhocFilter3.duplicateWith({ sqlExpression: 'value = 5' });

    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter3.equals(adhocFilter4)).to.be.false;
  });

  it('can determine if it is valid', () => {
    const adhocFilter1 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: '10',
      clause: CLAUSES.WHERE,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter1.isValid()).to.be.true;

    const adhocFilter2 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '>',
      comparator: null,
      clause: CLAUSES.WHERE,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter2.isValid()).to.be.false;

    const adhocFilter3 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'some expression',
      clause: null,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter3.isValid()).to.be.false;

    const adhocFilter4 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: 'in',
      comparator: [],
      clause: CLAUSES.WHERE,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter4.isValid()).to.be.false;

    const adhocFilter5 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: 'in',
      comparator: ['val1'],
      clause: CLAUSES.WHERE,
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocFilter5.isValid()).to.be.true;
  });

  it('can translate from simple expressions to sql expressions', () => {
    const adhocFilter1 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'value',
      operator: '==',
      comparator: '10',
      clause: CLAUSES.WHERE,
    });
    expect(adhocFilter1.translateToSql()).to.equal('value = 10');

    const adhocFilter2 = new AdhocFilter({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      subject: 'SUM(value)',
      operator: '!=',
      comparator: '5',
      clause: CLAUSES.HAVING,
    });
    expect(adhocFilter2.translateToSql()).to.equal('SUM(value) <> 5');
  });
});
