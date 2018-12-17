import readResponseBlob from '../../utils/readResponseBlob';
import { WORLD_HEALTH_DASHBOARD } from './dashboard.helper';

export default () => describe('save', () => {
  let dashboardId;
  let boxplotChartId;

  beforeEach(() => {
    cy.server();
    cy.login();
    cy.visit(WORLD_HEALTH_DASHBOARD);

    cy.get('#app').then((data) => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
      const dashboard = bootstrapData.dashboard_data;
      dashboardId = dashboard.id;
      boxplotChartId = dashboard.slices.find(slice => (slice.form_data.viz_type === 'box_plot')).slice_id;

      cy.route('POST', `/superset/copy_dash/${dashboardId}/`).as('copyRequest');
    });

    cy.get('#save-dash-split-button').trigger('click', { force: true });
    cy.contains('Save as').trigger('click', { force: true });
    cy.get('.modal-footer').contains('Save').trigger('click', { force: true });
  });

  it('should save as new dashboard', () => {
    cy.wait('@copyRequest').then((xhr) => {
      expect(xhr.status).to.eq(200);

      readResponseBlob(xhr.response.body).then((json) => {
        expect(json.id).to.be.gt(dashboardId);
      });
    });
  });

  it('should save/overwrite dashboard', () => {
    cy.wait('@copyRequest');

    // should have box_plot chart
    const boxplotRequest = `/superset/explore_json/?form_data={"slice_id":${boxplotChartId}}`;
    cy.route('POST', boxplotRequest).as('boxplotRequest');
    cy.wait('@boxplotRequest');
    cy.get('.grid-container .box_plot').should('be.exist');

    // remove box_plot chart from dashboard
    cy.get('.dashboard-header').contains('Edit dashboard').trigger('click', { force: true });
    cy.get('.fa.fa-trash').last().trigger('click', { force: true });
    cy.get('.grid-container .box_plot').should('not.exist');

    cy.route('POST', '/superset/save_dash/**/').as('saveRequest');
    cy.get('.dashboard-header').contains('Save changes').trigger('click', { force: true });

    // go back to view mode
    cy.wait('@saveRequest');
    cy.get('.dashboard-header').contains('Edit dashboard');
    cy.get('.grid-container .box_plot').should('not.exist');
  });
});
