import { WORLD_HEALTH_DASHBOARD } from './dashboard.helper';
import readResponseBlob from '../../utils/readResponseBlob';

export default () => describe('top-level controls', () => {
  const sliceRequests = [];
  const forceRefreshRequests = [];
  let mapId;

  beforeEach(() => {
    cy.server();
    cy.login();
    cy.visit(WORLD_HEALTH_DASHBOARD);

    cy.get('#app').then((data) => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
      const dashboard = bootstrapData.dashboard_data;
      const sliceIds = dashboard.slices.map(slice => (slice.slice_id));
      mapId = dashboard.slices.find(slice => (slice.form_data.viz_type === 'world_map')).slice_id;

      sliceIds
        .forEach((id) => {
          const sliceRequest = `getJson_${id}`;
          sliceRequests.push(`@${sliceRequest}`);
          cy.route('POST', `/superset/explore_json/?form_data={"slice_id":${id}}`).as(sliceRequest);

          const forceRefresh = `getJson_${id}_force`;
          forceRefreshRequests.push(`@${forceRefresh}`);
          cy.route('POST', `/superset/explore_json/?form_data={"slice_id":${id}}&force=true`).as(forceRefresh);
        });
    });
  });
  afterEach(() => {
    sliceRequests.length = 0;
    forceRefreshRequests.length = 0;
  });

  it('should allow chart level refresh', () => {
    cy.wait(sliceRequests);
    cy.get('.grid-container .world_map').should('be.exist');
    cy.get(`#slice_${mapId}-controls`).click();
    cy.get(`#slice_${mapId}-controls`).next()
      .find('.refresh-tooltip').trigger('click', { force: true });

    // not allow dashboard level force refresh when any chart is loading
    cy.get('#save-dash-split-button').trigger('click', { forece: true });
    cy.contains('Force refresh dashboard').parent().should('have.class', 'disabled');
    // not allow chart level force refresh when it is loading
    cy.get(`#slice_${mapId}-controls`).next()
      .find('.refresh-tooltip')
      .parent()
      .parent()
      .should('have.class', 'disabled');

    cy.wait(`@getJson_${mapId}_force`);
    cy.get('#save-dash-split-button').trigger('click');
    cy.contains('Force refresh dashboard').parent().not('have.class', 'disabled');
  });

  it('should allow dashboard level force refresh', () => {
    // when charts are not start loading, for example, under a secondary tab,
    // should allow force refresh
    cy.get('#save-dash-split-button').trigger('click');
    cy.contains('Force refresh dashboard').parent().not('have.class', 'disabled');

    // wait the all dash finish loading.
    cy.wait(sliceRequests);
    cy.get('#save-dash-split-button').trigger('click');
    cy.contains('Force refresh dashboard').trigger('click', { force: true });
    cy.get('#save-dash-split-button').trigger('click');
    cy.contains('Force refresh dashboard').parent().should('have.class', 'disabled');

    // wait all charts force refreshed
    cy.wait(forceRefreshRequests).then((xhrs) => {
      // is_cached in response should be false
      xhrs.forEach((xhr) => {
        readResponseBlob(xhr.response.body).then((responseBody) => {
          expect(responseBody.is_cached).to.equal(false);
        });
      });
    });

    cy.get('#save-dash-split-button').trigger('click');
    cy.contains('Force refresh dashboard').parent().not('have.class', 'disabled');
  });
});
