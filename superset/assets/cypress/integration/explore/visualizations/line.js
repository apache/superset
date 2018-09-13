import { FORM_DATA_DEFAULTS, NUM_METRIC } from './shared.helper';

describe('Line', () => {
  const LINE_CHART_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'line' };

  it('Test line chart with adhoc metric', () => {
    cy.server();
    cy.login();

    const formData = { ...LINE_CHART_DEFAULTS, metrics: [NUM_METRIC] };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with groupby', () => {
    cy.server();
    cy.login();

    const metrics = ['count'];
    const groupby = ['gender'];

    const formData = { ...LINE_CHART_DEFAULTS, metrics, groupby };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with simple filter', () => {
    cy.server();
    cy.login();

    const metrics = ['count'];
    const filters = [
      {
        expressionType: 'SIMPLE',
        subject: 'name',
        operator: 'in',
        comparator: ['Aaron', 'Amy', 'Andrea'],
        clause: 'WHERE',
        sqlExpression: null,
        fromFormData: true,
        filterOptionName: 'filter_4y6teao56zs_ebjsvwy48c',
      },
    ];

    const formData = { ...LINE_CHART_DEFAULTS, metrics, adhoc_filters: filters };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with series limit sort asc', () => {
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
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with series limit sort desc', () => {
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
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with rolling avg', () => {
    cy.server();
    cy.login();

    const metrics = [NUM_METRIC];

    const formData = { ...LINE_CHART_DEFAULTS, metrics, rolling_type: 'mean', rolling_periods: 10 };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with time shift 1 year', () => {
    cy.server();
    cy.login();

    const metrics = [NUM_METRIC];

    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics,
      time_compare: ['1+year'],
      comparison_type: 'values',
    };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with time shift yoy', () => {
    cy.server();
    cy.login();

    const metrics = [NUM_METRIC];

    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics,
      time_compare: ['1+year'],
      comparison_type: 'ratio',
    };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with time shift percentage change', () => {
    cy.server();
    cy.login();

    const metrics = [NUM_METRIC];

    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics,
      time_compare: ['1+year'],
      comparison_type: 'percentage',
    };

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });
});
