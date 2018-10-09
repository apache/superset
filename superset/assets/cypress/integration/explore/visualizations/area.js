export default () => describe('Area', () => {
  const AREA_FORM_DATA = {
    datasource: '2__table',
    viz_type: 'area',
    slice_id: 48,
    granularity_sqla: 'year',
    time_grain_sqla: 'P1D',
    time_range: '1960-01-01 : now',
    metrics: ['sum__SP_POP_TOTL'],
    adhoc_filters: [],
    groupby: [],
    limit: '25',
    order_desc: true,
    contribution: false,
    row_limit: 50000,
    show_brush: 'auto',
    show_legend: true,
    line_interpolation: 'linear',
    stacked_style: 'stack',
    color_scheme: 'bnbColors',
    rich_tooltip: true,
    show_controls: false,
    x_axis_label: '',
    bottom_margin: 'auto',
    x_ticks_layout: 'auto',
    x_axis_format: 'smart_date',
    x_axis_showminmax: false,
    y_axis_format: '.3s',
    y_log_scale: false,
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
    verify(AREA_FORM_DATA);
    cy.get('.nv-area').should('have.length', 1);
  });

  it('should work with group by', () => {
    verify({
      ...AREA_FORM_DATA,
      groupby: ['region'],
    });
    cy.get('.nv-area').should('have.length', 7);
  });

  it('should work with groupby and filter', () => {
    verify({
      ...AREA_FORM_DATA,
      groupby: ['region'],
      adhoc_filters: [{
        expressionType: 'SIMPLE',
        subject: 'region',
        operator: 'in',
        comparator: ['South Asia', 'North America'],
        clause: 'WHERE',
        sqlExpression: null,
        fromFormData: true,
        filterOptionName: 'filter_txje2ikiv6_wxmn0qwd1xo',
      }],
    });
    cy.get('.nv-area').should('have.length', 2);
  });
});
