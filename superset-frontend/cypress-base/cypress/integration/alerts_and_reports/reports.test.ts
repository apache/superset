import { REPORT_LIST } from './alert_report.helper';

describe('report list view', () => {
  beforeEach(() => {
    cy.login();
  });

  afterEach(() => {
    cy.eyesClose();
  });

  it('should load report lists', () => {
    cy.visit(REPORT_LIST);

    cy.get('[data-test="listview-table"]').should('be.visible');
    // check report list view header
    cy.get('[data-test="sort-header"]').eq(1).contains('Last run');
    cy.get('[data-test="sort-header"]').eq(2).contains('Name');
    cy.get('[data-test="sort-header"]').eq(3).contains('Schedule');
    cy.get('[data-test="sort-header"]').eq(4).contains('Notification method');
    cy.get('[data-test="sort-header"]').eq(5).contains('Created by');
    cy.get('[data-test="sort-header"]').eq(6).contains('Owners');
    cy.get('[data-test="sort-header"]').eq(7).contains('Active');
    cy.get('[data-test="sort-header"]').eq(8).contains('Actions');
  });
});
