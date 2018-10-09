import { FORM_DATA_DEFAULTS, NUM_METRIC, SIMPLE_FILTER } from './shared.helper';

export default () => describe('Line', () => {
  const LINE_CHART_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'line' };

  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('Test line chart with adhoc metric', () => {
    const formData = { ...LINE_CHART_DEFAULTS, metrics: [NUM_METRIC] };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with groupby', () => {
    const metrics = ['count'];
    const groupby = ['gender'];

    const formData = { ...LINE_CHART_DEFAULTS, metrics, groupby };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with simple filter', () => {
    const metrics = ['count'];
    const filters = [SIMPLE_FILTER];

    const formData = { ...LINE_CHART_DEFAULTS, metrics, adhoc_filters: filters };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with series limit sort asc', () => {
    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics: [NUM_METRIC],
      limit: 10,
      groupby: ['name'],
      timeseries_limit_metric: NUM_METRIC,
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with series limit sort desc', () => {
    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics: [NUM_METRIC],
      limit: 10,
      groupby: ['name'],
      timeseries_limit_metric: NUM_METRIC,
      order_desc: true,
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with rolling avg', () => {
    const metrics = [NUM_METRIC];

    const formData = { ...LINE_CHART_DEFAULTS, metrics, rolling_type: 'mean', rolling_periods: 10 };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with time shift 1 year', () => {
    const metrics = [NUM_METRIC];

    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics,
      time_compare: ['1+year'],
      comparison_type: 'values',
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with time shift yoy', () => {
    const metrics = [NUM_METRIC];

    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics,
      time_compare: ['1+year'],
      comparison_type: 'ratio',
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test line chart with time shift percentage change', () => {
    const metrics = [NUM_METRIC];

    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics,
      time_compare: ['1+year'],
      comparison_type: 'percentage',
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });
});
