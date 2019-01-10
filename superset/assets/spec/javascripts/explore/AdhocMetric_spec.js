import { expect } from 'chai';

import AdhocMetric, { EXPRESSION_TYPES } from '../../../src/explore/AdhocMetric';
import { AGGREGATES } from '../../../src/explore/constants';

const valueColumn = { type: 'DOUBLE', column_name: 'value' };

describe('AdhocMetric', () => {
  it('sets label, hasCustomLabel and optionName in constructor', () => {
    const adhocMetric = new AdhocMetric({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
    });
    expect(adhocMetric.optionName.length).to.be.above(10);
    expect(adhocMetric).to.deep.equal({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
      fromFormData: false,
      label: 'SUM(value)',
      hasCustomLabel: false,
      optionName: adhocMetric.optionName,
      sqlExpression: null,
    });
  });

  it('can create altered duplicates', () => {
    const adhocMetric1 = new AdhocMetric({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
    });
    const adhocMetric2 = adhocMetric1.duplicateWith({ aggregate: AGGREGATES.AVG });

    expect(adhocMetric1.column).to.equal(adhocMetric2.column);
    expect(adhocMetric1.column).to.equal(valueColumn);

    expect(adhocMetric1.aggregate).to.equal(AGGREGATES.SUM);
    expect(adhocMetric2.aggregate).to.equal(AGGREGATES.AVG);
  });

  it('can verify equality', () => {
    const adhocMetric1 = new AdhocMetric({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
    });
    const adhocMetric2 = adhocMetric1.duplicateWith({});

    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric1.equals(adhocMetric2)).to.be.true;
  });

  it('can verify inequality', () => {
    const adhocMetric1 = new AdhocMetric({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
      label: 'old label',
      hasCustomLabel: true,
    });
    const adhocMetric2 = adhocMetric1.duplicateWith({ label: 'new label' });

    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric1.equals(adhocMetric2)).to.be.false;

    const adhocMetric3 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'COUNT(*)',
      label: 'old label',
      hasCustomLabel: true,
    });
    const adhocMetric4 = adhocMetric3.duplicateWith({ sqlExpression: 'COUNT(1)' });

    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric3.equals(adhocMetric4)).to.be.false;
  });

  it('updates label if hasCustomLabel is false', () => {
    const adhocMetric1 = new AdhocMetric({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
    });
    const adhocMetric2 = adhocMetric1.duplicateWith({ aggregate: AGGREGATES.AVG });

    expect(adhocMetric2.label).to.equal('AVG(value)');
  });

  it('keeps label if hasCustomLabel is true', () => {
    const adhocMetric1 = new AdhocMetric({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
      hasCustomLabel: true,
      label: 'label1',
    });
    const adhocMetric2 = adhocMetric1.duplicateWith({ aggregate: AGGREGATES.AVG });

    expect(adhocMetric2.label).to.equal('label1');
  });

  it('can determine if it is valid', () => {
    const adhocMetric1 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
      hasCustomLabel: true,
      label: 'label1',
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric1.isValid()).to.be.true;

    const adhocMetric2 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      column: valueColumn,
      aggregate: null,
      hasCustomLabel: true,
      label: 'label1',
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric2.isValid()).to.be.false;

    const adhocMetric3 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'COUNT(*)',
      hasCustomLabel: true,
      label: 'label1',
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric3.isValid()).to.be.true;

    const adhocMetric4 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
      hasCustomLabel: true,
      label: 'label1',
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric4.isValid()).to.be.false;

    const adhocMetric5 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      hasCustomLabel: true,
      label: 'label1',
    });
    // eslint-disable-next-line no-unused-expressions
    expect(adhocMetric5.isValid()).to.be.false;
  });

  it('can translate back from sql expressions to simple expressions when possible', () => {
    const adhocMetric = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'AVG(my_column)',
      hasCustomLabel: true,
      label: 'label1',
    });
    expect(adhocMetric.inferSqlExpressionColumn()).to.equal('my_column');
    expect(adhocMetric.inferSqlExpressionAggregate()).to.equal('AVG');

    const adhocMetric2 = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'AVG(SUM(my_column)) / MAX(other_column)',
      hasCustomLabel: true,
      label: 'label1',
    });
    expect(adhocMetric2.inferSqlExpressionColumn()).to.equal(null);
    expect(adhocMetric2.inferSqlExpressionAggregate()).to.equal(null);
  });

  it('will infer columns and aggregates when converting to a simple expression', () => {
    const adhocMetric = new AdhocMetric({
      expressionType: EXPRESSION_TYPES.SQL,
      sqlExpression: 'AVG(my_column)',
      hasCustomLabel: true,
      label: 'label1',
    });
    const adhocMetric2 = adhocMetric.duplicateWith({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      aggregate: AGGREGATES.SUM,
    });
    expect(adhocMetric2.aggregate).to.equal(AGGREGATES.SUM);
    expect(adhocMetric2.column.column_name).to.equal('my_column');

    const adhocMetric3 = adhocMetric.duplicateWith({
      expressionType: EXPRESSION_TYPES.SIMPLE,
      column: valueColumn,
    });
    expect(adhocMetric3.aggregate).to.equal(AGGREGATES.AVG);
    expect(adhocMetric3.column.column_name).to.equal('value');
  });
});
