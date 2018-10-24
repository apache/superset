import { WORLD_HEALTH_DASHBOARD, CHECK_DASHBOARD_FAVORITE_ENDPOINT } from './dashboard.helper';

export default () => describe('favorite dashboard', () => {
  let isFavoriteDashboard = false;

  beforeEach(() => {
    cy.server();
    cy.login();

    cy.route(CHECK_DASHBOARD_FAVORITE_ENDPOINT).as('countFavStar');
    cy.visit(WORLD_HEALTH_DASHBOARD);

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
});
