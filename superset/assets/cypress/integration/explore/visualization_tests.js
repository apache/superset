// ***********************************************
// Tests for visualization types
// ***********************************************

const FORM_DATA_DEFAULTS = {
  datasource: '3__table',
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

const NUM_METRIC = {
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
    label: 'Sum(num)',
    optionName: 'metric_1de0s4viy5d_ly7y8k6ghvk',
  };

describe('Line', function () {
  const LINE_CHART_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'line' };

  it('Test line chart with adhoc metric', function () {
    cy.server();
    cy.login();

    const formData = { ...LINE_CHART_DEFAULTS, metrics: [NUM_METRIC] };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  });

  it('Test line chart with groupby', function () {
    cy.server();
    cy.login();

    const metrics = ['count'];
    const groupby = ['gender'];

    const formData = { ...LINE_CHART_DEFAULTS, metrics, groupby };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  });

  it('Test line chart with simple filter', function () {
    cy.server();
    cy.login();

    const metrics = ['count'];
    const filters = [{
      expressionType: 'SIMPLE',
      subject: 'name',
      operator: 'in',
      comparator: ['Aaron', 'Amy', 'Andrea'],
      clause: 'WHERE',
      sqlExpression: null,
      fromFormData: true,
      filterOptionName: 'filter_4y6teao56zs_ebjsvwy48c',
    }];

    const formData = { ...LINE_CHART_DEFAULTS, metrics, adhoc_filters: filters };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  });

  it('Test line chart with series limit sort asc', function () {
    cy.server();
    cy.login();

    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics: [NUM_METRIC],
      limit: 10,
      groupby: ['name'],
      timeseries_limit_metric: NUM_METRIC,
    };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  });

  it('Test line chart with series limit sort desc', function () {
    cy.server();
    cy.login();

    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics: [NUM_METRIC],
      limit: 10,
      groupby: ['name'],
      timeseries_limit_metric: NUM_METRIC,
      order_desc: true,
    };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  });

  it('Test line chart with rolling avg', function () {
    cy.server();
    cy.login();

    const metrics = [NUM_METRIC];

    const formData = { ...LINE_CHART_DEFAULTS, metrics, rolling_type: 'mean', rolling_periods: 10 };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  });

  it('Test line chart with time shift 1 year', function () {
    cy.server();
    cy.login();

    const metrics = [NUM_METRIC];

    const formData = { ...LINE_CHART_DEFAULTS, metrics, time_compare: ['1+year'], comparison_type: 'values' };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  });

  it('Test line chart with time shift yoy', function () {
    cy.server();
    cy.login();

    const metrics = [NUM_METRIC];

    const formData = { ...LINE_CHART_DEFAULTS, metrics, time_compare: ['1+year'], comparison_type: 'ratio' };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  });

  it('Test line chart with time shift percentage change', function () {
    cy.server();
    cy.login();

    const metrics = [NUM_METRIC];

    const formData = { ...LINE_CHART_DEFAULTS, metrics, time_compare: ['1+year'], comparison_type: 'percentage' };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  });
});


// Big Number Total

describe('Big Number', function () {
  const BIG_NUMBER_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'big_number_total' };

  it('Test big number chart with adhoc metric', function () {
    cy.server();
    cy.login();

    const formData = { ...BIG_NUMBER_DEFAULTS, metric: NUM_METRIC };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', querySubstring: NUM_METRIC.label, getSvg: false });
  });

  it('Test big number chart with simple filter', function () {
    cy.server();
    cy.login();

    const filters = [{
      expressionType: 'SIMPLE',
      subject: 'name',
      operator: 'in',
      comparator: ['Aaron', 'Amy', 'Andrea'],
      clause: 'WHERE',
      sqlExpression: null,
      fromFormData: true,
      filterOptionName: 'filter_4y6teao56zs_ebjsvwy48c',
    }];

    const formData = { ...BIG_NUMBER_DEFAULTS, metric: 'count', adhoc_filters: filters };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', getSvg: false });
  });

  it('Test big number chart ignores groupby', function () {
    cy.server();
    cy.login();

    const formData = { ...BIG_NUMBER_DEFAULTS, metric: NUM_METRIC, groupby: ['state'] };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.wait(['@getJson']).then((data) => {
      expect(data.status).to.eq(200);
      expect(data.response.body).to.have.property('error', null);
      expect(data.response.body.query).not.contains(formData.groupby[0]);
      cy.get('.slice_container');
    });
  });
});
