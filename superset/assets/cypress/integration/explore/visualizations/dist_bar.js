import { FORM_DATA_DEFAULTS, NUM_METRIC } from './shared.helper';

// Dist bar

export default () => describe('Distribution bar chart', () => {
  const VIZ_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'dist_bar' };

  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('Test dist bar with adhoc metric', () => {
    const formData = { ...VIZ_DEFAULTS, metrics: NUM_METRIC, groupby: ['state'] };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      querySubstring: NUM_METRIC.label,
      chartSelector: 'svg',
    });
  });

  it('Test dist bar with series', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      metrics: NUM_METRIC,
      groupby: ['state'],
      columns: ['gender'],
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test dist bar with row limit', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      metrics: NUM_METRIC,
      groupby: ['state'],
      row_limit: 10,
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('Test dist bar with contribution', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      metrics: NUM_METRIC,
      groupby: ['state'],
      columns: ['gender'],
      contribution: true,
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });
});
