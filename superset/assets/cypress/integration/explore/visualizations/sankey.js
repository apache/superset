export default () => describe('Sankey', () => {
  const SANKEY_FORM_DATA = {
    datasource: '1__table',
    viz_type: 'sankey',
    slice_id: 1,
    url_params: {},
    granularity_sqla: null,
    time_grain_sqla: 'P1D',
    time_range: 'Last+week',
    groupby: ['source', 'target'],
    metric: 'sum__value',
    adhoc_filters: [],
    row_limit: '5000',
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

  it('should work', () => {
    verify(SANKEY_FORM_DATA);
    cy.get('.chart-container svg g.node rect').should('have.length', 41);
  });

  it('should work with filter', () => {
    verify({
      ...SANKEY_FORM_DATA,
      adhoc_filters: [
        {
          expressionType: 'SQL',
          sqlExpression: 'SUM(value)+>+0',
          clause: 'HAVING',
          subject: null,
          operator: null,
          comparator: null,
          fromFormData: false,
          filterOptionName: 'filter_jbdwe0hayaj_h9jfer8fy58',
        }, {
          expressionType: 'SIMPLE',
          subject: 'source',
          operator: '==',
          comparator: 'Energy',
          clause: 'WHERE',
          sqlExpression: null,
          fromFormData: true,
          filterOptionName: 'filter_8e0otka9uif_vmqri4gmbqc',
        },
      ],
    });
    cy.get('.chart-container svg g.node rect').should('have.length', 6);
  });
});
