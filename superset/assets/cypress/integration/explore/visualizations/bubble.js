export default () => describe('Bubble', () => {
  const BUBBLE_FORM_DATA = {
    datasource: '2__table',
    viz_type: 'bubble',
    slice_id: 46,
    granularity_sqla: 'year',
    time_grain_sqla: 'P1D',
    time_range: '2011-01-01+:+2011-01-02',
    series: 'region',
    entity: 'country_name',
    x: 'sum__SP_RUR_TOTL_ZS',
    y: 'sum__SP_DYN_LE00_IN',
    size: 'sum__SP_POP_TOTL',
    max_bubble_size: '50',
    limit: 0,
    color_scheme: 'bnbColors',
    show_legend: true,
    x_axis_label: '',
    left_margin: 'auto',
    x_axis_format: '.3s',
    x_ticks_layout: 'auto',
    x_log_scale: false,
    x_axis_showminmax: false,
    y_axis_label: '',
    bottom_margin: 'auto',
    y_axis_format: '.3s',
    y_log_scale: false,
    y_axis_showminmax: false,
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
    verify(BUBBLE_FORM_DATA);
    cy.get('.chart-container svg circle').should('have.length', 208);
  });

  it('should work with filter', () => {
    verify({
      ...BUBBLE_FORM_DATA,
      adhoc_filters: [{
        expressionType: 'SIMPLE',
        subject: 'region',
        operator: '==',
        comparator: 'South+Asia',
        clause: 'WHERE',
        sqlExpression: null,
        fromFormData: true,
        filterOptionName: 'filter_b2tfg1rs8y_8kmrcyxvsqd',
      }],
    });
    cy.get('.chart-container svg circle')
      .should('have.length', 9)
      .then((nodeList) => {
        // Check that all circles have same color.
        const color = nodeList[0].getAttribute('fill');
        const circles = Array.prototype.slice.call(nodeList);
        expect(circles.every(c => c.getAttribute('fill') === color)).to.equal(true);
      });
  });

});
