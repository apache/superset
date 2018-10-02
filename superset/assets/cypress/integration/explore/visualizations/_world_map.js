export default () => describe('World Map', () => {
  const WORLD_MAP_FORM_DATA = {
    datasource: '2__table',
    viz_type: 'world_map',
    slice_id: 45,
    granularity_sqla: 'year',
    time_grain_sqla: 'P1D',
    time_range: '2014-01-01 : 2014-01-02',
    entity: 'country_code',
    country_fieldtype: 'cca3',
    metric: 'sum__SP_RUR_TOTL_ZS',
    adhoc_filters: [],
    row_limit: 50000,
    show_bubbles: true,
    secondary_metric: 'sum__SP_POP_TOTL',
    max_bubble_size: '25',
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
    verify(WORLD_MAP_FORM_DATA);
    cy.get('.bubbles circle.datamaps-bubble').should('have.length', 206);
  });

  it('should work with simple filter', () => {
    verify({
      ...WORLD_MAP_FORM_DATA,
      metric: 'count',
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
    cy.get('.bubbles circle.datamaps-bubble').should('have.length', 8);
  });

  it('should hide bubbles when told so', () => {
    verify({
      ...WORLD_MAP_FORM_DATA,
      show_bubbles: false,
    });
    cy.get('.slice_container').then((containers) => {
      expect(containers[0].querySelectorAll('.bubbles circle.datamaps-bubble').length).to.equal(0);
    });
  });
});
