import { expect } from 'chai';
import { describe, it } from 'mocha';

import AdhocMetric from '../../../javascripts/explore/AdhocMetric';
import { AGGREGATES } from '../../../javascripts/explore/constants';

const valueColumn = { type: 'DOUBLE', column_name: 'value' };

describe('AdhocMetric', () => {
  it('sets label, hasCustomLabel and optionName in constructor', () => {
    const adhocMetric = new AdhocMetric({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
    });
    expect(adhocMetric.optionName.length).to.be.above(10);
    expect(adhocMetric).to.deep.equal({
      column: valueColumn,
      aggregate: AGGREGATES.SUM,
      fromFormData: false,
      label: 'SUM(value)',
      hasCustomLabel: false,
      optionName: adhocMetric.optionName,
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
});
