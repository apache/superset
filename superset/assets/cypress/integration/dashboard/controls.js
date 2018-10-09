import { WORLD_HEALTH_DASHBOARD, CHECK_DASHBOARD_FAVORITE_ENDPOINT } from './dashboard.helper';

export default () => describe('top-level controls', () => {
  let sliceIds = [];
  let dashboard = {};
  let isFavoriteDashboard = false;

  beforeEach(() => {
    cy.server();
    cy.login();

    cy.route(CHECK_DASHBOARD_FAVORITE_ENDPOINT).as('countFavStar');
    cy.visit(WORLD_HEALTH_DASHBOARD);

    cy.get('#app').then((data) => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
      dashboard = bootstrapData.dashboard_data;
      sliceIds = dashboard.slices.map(slice => (slice.slice_id));
    });

    cy.wait('@countFavStar').then((xhr) => {
      isFavoriteDashboard = xhr.response.body.count === 1;
    });
  });

  it('should allow favor/unfavor', () => {
    if (!isFavoriteDashboard) {
      cy.get('.favstar').find('i').should('have.class', 'fa-star-o');
      cy.get('.favstar').trigger('click');
      cy.get('.favstar').find('i').should('have.class', 'fa-star')
        .and('not.have.class', 'fa-star-o');
    } else {
      cy.get('.favstar').find('i').should('have.class', 'fa-star')
        .and('not.have.class', 'fa-star-o');
      cy.get('.favstar').trigger('click');
      cy.get('.fave-unfave-icon').find('i').should('have.class', 'fa-star-o')
        .and('not.have.class', 'fa-star');
    }

    // reset to original fav state
    cy.get('.favstar').trigger('click');
  });

  it('should allow auto refresh', () => {
    const sliceRequests = [];
    const forceRefreshRequests = [];
    sliceIds
      .forEach((id) => {
        const sliceRequest = `getJson_${id}`;
        sliceRequests.push(`@${sliceRequest}`);
        cy.route('POST', `/superset/explore_json/?form_data={"slice_id":${id}}`).as(sliceRequest);

        const forceRefresh = `getJson_${id}_force`;
        forceRefreshRequests.push(`@${forceRefresh}`);
        cy.route('POST', `/superset/explore_json/?form_data={"slice_id":${id}}&force=true`).as(forceRefresh);
      });

    cy.wait(sliceRequests);
    cy.get('#save-dash-split-button').trigger('click');
    cy.contains('Force refresh dashboard').click();

    cy.wait(forceRefreshRequests).then((xhrs) => {
      // is_cached in response should be false
      xhrs.forEach((xhr) => {
        expect(xhr.response.body.is_cached).to.equal(false);
      });
    });
  });
});
