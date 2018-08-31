// ***********************************************
// Tests for visualization types
// ***********************************************

const FORM_DATA_DEFAULTS = {
  datasource: '3__table',
  viz_type: 'line',
  granularity_sqla: 'ds',
  time_grain_sqla: null,
  time_range: '100+years+ago+:+now',
  adhoc_filters: [],
  groupby: [],
  limit: null,
  timeseries_limit_metric: null,
  order_desc: false,
  contribution: false,
};

describe('Line', function () {
  it('Test line chart with adhoc metric', function () {
    cy.server();
    cy.login();

    const metrics = [{
      expressionType: 'SIMPLE',
      column: {
        id: 336,
        column_name: 'num',
        verbose_name: null,
        description: null,
        expression: '',
        filterable: false,
        groupby: false,
        is_dttm: false,
        type: 'BIGINT',
        database_expression: null,
        python_date_format: null,
        optionName: '_col_num',
      },
      aggregate: 'SUM',
      sqlExpression: null,
      hasCustomLabel: false,
      fromFormData: false,
      label: 'SUM(num)',
      optionName: 'metric_1de0s4viy5d_ly7y8k6ghvk',
    }];

    const formData = { ...FORM_DATA_DEFAULTS, metrics };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess('@getJson');
  });
});
