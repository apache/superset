export default () => describe('Treemap', () => {
  const TREEMAP_FORM_DATA = {
    datasource: '2__table',
    viz_type: 'treemap',
    slice_id: 50,
    granularity_sqla: 'year',
    time_grain_sqla: 'P1D',
    time_range: '1960-01-01+:+now',
    metrics: ['sum__SP_POP_TOTL'],
    adhoc_filters: [],
    groupby: ['country_code'],
    row_limit: 50000,
    color_scheme: 'bnbColors',
    treemap_ratio: 1.618033988749895,
    number_format: '.3s',
  };

  function verify(formData) {
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  }

  beforeEach(() => {
    cy.server();
    cy.login();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('should work', () => {
    verify(TREEMAP_FORM_DATA);
    cy.get('.chart-container svg rect.child').should('have.length', 214);
  });

  it('should work with multiple groupby', () => {
    verify({
      ...TREEMAP_FORM_DATA,
      groupby: ['region', 'country_code'],
    });
    cy.get('.chart-container svg rect.parent').should('have.length', 7);
    cy.get('.chart-container svg rect.child').should('have.length', 214);
  });

  it('should work with filter', () => {
    verify({
      ...TREEMAP_FORM_DATA,
      adhoc_filters: [{
        expressionType: 'SIMPLE',
        subject: 'region',
        operator: '==',
        comparator: 'South Asia',
        clause: 'WHERE',
        sqlExpression: null,
        fromFormData: true,
        filterOptionName: 'filter_8aqxcf5co1a_x7lm2d1fq0l',
      }],
    });
    cy.get('.chart-container svg rect.child').should('have.length', 8);
  });
});
