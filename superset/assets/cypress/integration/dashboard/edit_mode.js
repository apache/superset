import { WORLD_HEALTH_DASHBOARD } from './dashboard.helper';

export default () => describe('edit mode', () => {
  beforeEach(() => {
    cy.server();
    cy.login();

    cy.visit(WORLD_HEALTH_DASHBOARD);
    cy.get('#app').then((data) => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
      const dashboard = bootstrapData.dashboard_data;
      const boxplotChartId = dashboard.slices.find(slice => (slice.form_data.viz_type === 'box_plot')).slice_id;
      const boxplotRequest = `/superset/explore_json/?form_data={"slice_id":${boxplotChartId}}`;
      cy.route('POST', boxplotRequest).as('boxplotRequest');
    });

    cy.get('.dashboard-header').contains('Edit dashboard').click();
  });

  it('remove, and add chart flow', () => {
    // wait box_plot data and find box plot
    cy.wait('@boxplotRequest');
    cy.get('.grid-container .box_plot').should('be.exist');

    cy.get('.fa.fa-trash').last().then(($el) => {
      cy.wrap($el).invoke('show').click();

      // box plot should be gone
      cy.get('.grid-container .box_plot').should('not.exist');
    });

    // open charts list
    cy.get('.component-layer').contains('Your charts & filters').click();

    // find box plot is available from list
    cy.get('.slices-layer').find('.chart-card-container').contains('Box plot');

    // drag-n-drop
    const dataTransfer = { data: {} };
    cy.get('.dragdroppable').contains('Box plot')
      .trigger('mousedown', { which: 1 })
      .trigger('dragstart', { dataTransfer })
      .trigger('drag', {});
    cy.get('.grid-content .dragdroppable').last()
      .trigger('dragover', { dataTransfer })
      .trigger('drop', { dataTransfer })
      .trigger('dragend', { dataTransfer })
      .trigger('mouseup', { which: 1 });

    // add back to dashboard
    cy.get('.grid-container .box_plot').should('be.exist');

    // should show Save changes button
    cy.get('.dashboard-header .button-container').contains('Save changes');

    // undo 2 steps
    cy.get('.dashboard-header .undo-action').click().click();

    // no changes, can switch to view mode
    cy.get('.dashboard-header .button-container').contains('Switch to view mode').click();
  });
});
