import { MULTI_OPERATORS } from './constants';

export const EXPRESSION_TYPES = {
  SIMPLE: 'SIMPLE',
  SQL: 'SQL',
};

export const CLAUSES = {
  HAVING: 'HAVING',
  WHERE: 'WHERE',
};

const OPERATORS_TO_SQL = {
  '==': '=',
  '!=': '<>',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  in: 'in',
  'not in': 'not in',
  LIKE: 'like',
};

function translateToSql(adhocMetric, { useSimple } = {}) {
  if (adhocMetric.expressionType === EXPRESSION_TYPES.SIMPLE || useSimple) {
    const isMulti = MULTI_OPERATORS.indexOf(adhocMetric.operator) >= 0;
    const subject = adhocMetric.subject;
    const operator = OPERATORS_TO_SQL[adhocMetric.operator];
    const comparator = isMulti ? adhocMetric.comparator.join("','") : adhocMetric.comparator;
    return `${subject} ${operator} ${isMulti ? '(\'' : ''}${comparator}${isMulti ? '\')' : ''}`;
  } else if (adhocMetric.expressionType === EXPRESSION_TYPES.SQL) {
    return adhocMetric.sqlExpression;
  }
  return '';
}

export default class AdhocFilter {
  constructor(adhocFilter) {
    this.expressionType = adhocFilter.expressionType || EXPRESSION_TYPES.SIMPLE;
    if (this.expressionType === EXPRESSION_TYPES.SIMPLE) {
      this.subject = adhocFilter.subject;
      this.operator = adhocFilter.operator;
      this.comparator = adhocFilter.comparator;
      this.clause = adhocFilter.clause;
      this.sqlExpression = null;
    } else if (this.expressionType === EXPRESSION_TYPES.SQL) {
      this.sqlExpression = typeof adhocFilter.sqlExpression === 'string' ?
        adhocFilter.sqlExpression :
        translateToSql(adhocFilter, { useSimple: true });
      this.clause = adhocFilter.clause;
      this.subject = null;
      this.operator = null;
      this.comparator = null;
    }
    this.fromFormData = !!adhocFilter.filterOptionName;

    this.filterOptionName = adhocFilter.filterOptionName ||
      `filter_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
  }

  duplicateWith(nextFields) {
    return new AdhocFilter({
      ...this,
      expressionType: this.expressionType,
      subject: this.subject,
      operator: this.operator,
      clause: this.clause,
      sqlExpression: this.sqlExpression,
      fromFormData: this.fromFormData,
      filterOptionName: this.filterOptionName,
      ...nextFields,
    });
  }

  equals(adhocFilter) {
    return adhocFilter.expressionType === this.expressionType &&
      adhocFilter.sqlExpression === this.sqlExpression &&
      adhocFilter.operator === this.operator &&
      adhocFilter.comparator === this.comparator &&
      adhocFilter.subject === this.subject;
  }

  isValid() {
    if (this.expressionType === EXPRESSION_TYPES.SIMPLE) {
      return !!(
        this.operator &&
        this.subject &&
        this.comparator &&
        this.comparator.length > 0 &&
        this.clause
      );
    } else if (this.expressionType === EXPRESSION_TYPES.SQL) {
      return !!(this.sqlExpression && this.clause);
    }
    return false;
  }

  getDefaultLabel() {
    const label = this.translateToSql();
    return label.length < 43 ?
      label :
      label.substring(0, 40) + '...';
  }

  translateToSql() {
    return translateToSql(this);
  }
}
