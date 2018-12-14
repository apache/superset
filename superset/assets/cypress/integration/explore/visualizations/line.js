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

  it('Test verbose name shows up in legend', () => {
    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics: ['count'],
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
    cy.get('text.nv-legend-text').contains('COUNT(*)');
  });

  it('Test hidden annotation', () => {
    const formData = {
      ...LINE_CHART_DEFAULTS,
      metrics: ['count'],
      annotation_layers: [{
        name: 'Goal+line',
        annotationType: 'FORMULA',
        sourceType: '',
        value: 'y=140000',
        overrides: { time_range: null },
        show: false,
        titleColumn: '',
        descriptionColumns: [],
        timeColumn: '',
        intervalEndColumn: '',
        color: null,
        opacity: '',
        style: 'solid',
        width: 1,
        showMarkers: false,
        hideLine: false,
      }],
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
    cy.get('.slice_container').within(() => {
      // Goal line annotation doesn't show up in legend
      cy.get('.nv-legend-text').should('have.length', 1);
    });
  });

  it('Test event annotation time override', () => {
    cy.request('/chart/api/read?_flt_3_slice_name=Daily+Totals').then((response) => {
      const value = response.body.pks[0];
      const formData = {
        ...LINE_CHART_DEFAULTS,
        metrics: ['count'],
        annotation_layers: [{
          name: 'Yearly date',
          annotationType: 'EVENT',
          sourceType: 'table',
          value,
          overrides: { time_range: null },
          show: true,
          titleColumn: 'ds',
          descriptionColumns: ['ds'],
          timeColumn: 'ds',
          color: null,
          opacity: '',
          style: 'solid',
          width: 1,
          showMarkers: false,
          hideLine: false,
        }],
      };
      cy.visitChartByParams(JSON.stringify(formData));
    });

    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
    cy.get('.slice_container').within(() => {
      cy.get('.nv-event-annotation-layer-0').children().should('have.length', 44);
    });
  });
});
