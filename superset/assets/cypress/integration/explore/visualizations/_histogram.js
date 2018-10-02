export default () => describe('Histogram', () => {
  const HISTOGRAM_FORM_DATA = {
    datasource: '3__table',
    viz_type: 'histogram',
    slice_id: 60,
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1D',
    time_range: '100 years ago : now',
    all_columns_x: ['num'],
    adhoc_filters: [],
    row_limit: 50000,
    groupby: [],
    color_scheme: 'bnbColors',
    link_length: 5,
    x_axis_label: 'Frequency',
    y_axis_label: 'Num',
    global_opacity: 1,
    normalized: false,
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

  it('should work without groupby', () => {
    verify(HISTOGRAM_FORM_DATA);
    cy.get('.chart-container svg .vx-bar').should('have.length', 6);
  });

  it('should with group by', () => {
    verify({
      ...HISTOGRAM_FORM_DATA,
      groupby: ['gender'],
    });
    cy.get('.chart-container svg .vx-bar').should('have.length', 12);
  });

  it('should work with filter', () => {
    verify({
      ...HISTOGRAM_FORM_DATA,
      adhoc_filters: [{
        expressionType: 'SIMPLE',
        subject: 'gender',
        operator: '==',
        comparator: 'boy',
        clause: 'WHERE',
        sqlExpression: null,
        fromFormData: true,
        filterOptionName: 'filter_tqx1en70hh_7nksse7nqic',
      }],
    });
    cy.get('.chart-container svg .vx-bar').should('have.length', 5);
  });

});
