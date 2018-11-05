import { FORM_DATA_DEFAULTS } from './shared.helper';

export default () => describe('FilterBox', () => {
  const VIZ_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'filter_box' };

  function verify(formData) {
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  }

  beforeEach(() => {
    cy.server();
    cy.login();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('should work with default date filter', () => {
    verify(VIZ_DEFAULTS);
    // Filter box should default to having a date filter with no filter selected
    cy.get('div.filter_box').within(() => {
      cy.get('span').contains('No filter');
    });
  });

});
