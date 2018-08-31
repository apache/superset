// ***********************************************
// Tests for setting controls in the UI
// ***********************************************

describe('Groupby', function () {
  it('Set groupby', function () {
    cy.server();
    cy.login();

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess('@getJson');

    cy.get('[data-test=groupby]').within(() => {
      cy.get('.Select-control').click();
      cy.get('input.select-input').type('state', { force: true });
      cy.get('.VirtualizedSelectFocusedOption').click();
    });
    cy.get('button.query').click();
    cy.verifySliceSuccess('@getJson');
  });
});

describe('SimpleAdhocMetric', function () {
  it('Clear metric and set simple adhoc metric', function () {
    cy.server();
    cy.login();

    const metricName = 'Girl Births';

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess('@getJson');

    cy.get('[data-test=metrics]').within(() => {
      cy.get('.select-clear').click();
      cy.get('.Select-control').click({ force: true });
      cy.get('input').type('sum_girls', { force: true });
      cy.get('.VirtualizedSelectFocusedOption').trigger('mousedown').click();
    });

    cy.get('#metrics-edit-popover').within(() => {
      cy.get('.popover-title').within(() => {
        cy.get('span').click();
        cy.get('input').type(metricName);
      });
      cy.get('button').contains('Save').click();
    });

    cy.get('button.query').click();
    cy.wait(['@getJson']).then((data) => {
      expect(data.status).to.eq(200);
      expect(data.response.body).to.have.property('error', null);
      expect(data.response.body.data[0].key).to.equal(metricName);
      cy.get('.slice_container');
    });
  });
});

