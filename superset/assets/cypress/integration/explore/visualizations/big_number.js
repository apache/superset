export default () => describe('Big Number', () => {
  const BIG_NUMBER_FORM_DATA = {
    datasource: '2__table',
    viz_type: 'big_number',
    slice_id: 42,
    granularity_sqla: 'year',
    time_grain_sqla: 'P1D',
    time_range: '2000+:+2014-01-02',
    metric: 'sum__SP_POP_TOTL',
    adhoc_filters: [],
    compare_lag: '10',
    compare_suffix: 'over+10Y',
    y_axis_format: '.3s',
    show_trend_line: true,
    start_y_axis_at_zero: true,
    color_picker: {
      r: 0,
      g: 122,
      b: 135,
      a: 1,
    },
  };

  function verify(formData) {
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: '.big_number' });
  }

  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('should work', () => {
    verify(BIG_NUMBER_FORM_DATA);
    cy.get('.chart-container .header_line');
    cy.get('.chart-container .subheader_line');
    cy.get('.chart-container svg path.vx-linepath');
  });

  it('should work without subheader', () => {
    verify({
      ...BIG_NUMBER_FORM_DATA,
      compare_lag: null,
    });
    cy.get('.chart-container .header_line');
    cy.get('.chart-container .subheader_line');
    cy.get('.chart-container svg path.vx-linepath');
  });

  it('should not render trendline when hidden', () => {
    verify({
      ...BIG_NUMBER_FORM_DATA,
      show_trend_line: false,
    });
    cy.get('.chart-container .header_line');
    cy.get('.chart-container .subheader_line');
    cy.get('.chart-container').then((containers) => {
      expect(containers[0].querySelector('svg')).to.equal(null);
    });
  });
});
