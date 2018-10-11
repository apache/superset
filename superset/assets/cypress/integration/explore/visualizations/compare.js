export default () => describe('Compare', () => {
  const COMPARE_FORM_DATA = {
    datasource: '3__table',
    viz_type: 'compare',
    slice_id: 60,
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1D',
    time_range: '100 years ago : now',
    metrics: ['count'],
    adhoc_filters: [],
    groupby: [],
    order_desc: true,
    contribution: false,
    row_limit: 50000,
    color_scheme: 'bnbColors',
    x_axis_label: 'Frequency',
    bottom_margin: 'auto',
    x_ticks_layout: 'auto',
    x_axis_format: 'smart_date',
    x_axis_showminmax: false,
    y_axis_label: 'Num',
    left_margin: 'auto',
    y_axis_showminmax: false,
    y_log_scale: false,
    y_axis_format: '.3s',
    rolling_type: 'None',
    comparison_type: 'values',
    annotation_layers: [],
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
    verify(COMPARE_FORM_DATA);
    cy.get('.chart-container .nvd3 path.nv-line').should('have.length', 1);
  });

  it('should with group by', () => {
    verify({
      ...COMPARE_FORM_DATA,
      groupby: ['gender'],
    });
    cy.get('.chart-container .nvd3 path.nv-line').should('have.length', 2);
  });

  it('should work with filter', () => {
    verify({
      ...COMPARE_FORM_DATA,
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
    cy.get('.chart-container .nvd3 path.nv-line').should('have.length', 1);
  });

});
