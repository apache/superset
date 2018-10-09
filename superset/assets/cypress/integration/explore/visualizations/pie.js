export default () => describe('Pie', () => {
  const PIE_FORM_DATA = {
    datasource: '3__table',
    viz_type: 'pie',
    slice_id: 55,
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1D',
    time_range: '100 years ago : now',
    metric: 'sum__num',
    adhoc_filters: [],
    groupby: ['gender'],
    row_limit: 50000,
    pie_label_type: 'key',
    donut: false,
    show_legend: true,
    show_labels: true,
    labels_outside: true,
    color_scheme: 'bnbColors',
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

  it('should work with ad-hoc metric', () => {
    verify(PIE_FORM_DATA);
    cy.get('.chart-container .nv-pie .nv-slice path').should('have.length', 2);
  });

  it('should work with simple filter', () => {
    verify({
      ...PIE_FORM_DATA,
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
    cy.get('.chart-container .nv-pie .nv-slice path').should('have.length', 1);
  });
});
