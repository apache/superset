import { FORM_DATA_DEFAULTS, NUM_METRIC, SIMPLE_FILTER } from './shared.helper';

// Timeseries bar

export default() => describe('Bar chart', () => {
  const VIZ_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'bar' };

  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('Test bar chart with adhoc metric', () => {
    const formData = { ...VIZ_DEFAULTS, metrics: NUM_METRIC };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      querySubstring: NUM_METRIC.label,
      chartSelector: 'svg',
    });
  });

  it('Test bar chart with groupby', () => {
    const groupbyCol = 'gender';
    const formData = {
      ...VIZ_DEFAULTS,
      metrics: NUM_METRIC,
      groupby: [groupbyCol],
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      chartSelector: 'svg',
      querySubstring: groupbyCol,
    });
  });

  it('Test bar chart with simple filter', () => {
    const metrics = [NUM_METRIC];
    const filters = [SIMPLE_FILTER];

    const formData = { ...VIZ_DEFAULTS, metrics, adhoc_filters: filters };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test bar chart with series limit sort asc', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      metrics: [NUM_METRIC],
      limit: 2,
      groupby: ['name'],
      timeseries_limit_metric: NUM_METRIC,
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test bar chart with rolling avg', () => {
    const metrics = [NUM_METRIC];

    const formData = { ...VIZ_DEFAULTS, metrics, rolling_type: 'mean', rolling_periods: 10 };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test bar chart with time shift yoy', () => {
    const metrics = [NUM_METRIC];

    const formData = {
      ...VIZ_DEFAULTS,
      metrics,
      time_compare: ['1+year'],
      comparison_type: 'ratio',
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });
});
