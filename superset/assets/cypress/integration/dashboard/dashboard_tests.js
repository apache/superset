describe('Load dashboard', () => {
  it('Load birth names dashboard', () => {
    cy.server();
    cy.login();
    // go to the dashboard and get list of slices first
    cy.visit('/superset/dashboard/births');
    cy.get('#app').then((data) => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
      const slices = bootstrapData.dashboard_data.slices;
      // then define routes and create alias for each requests
      const aliases = slices.map((slice) => {
        const alias = `getJson_${slice.slice_id}`;
        cy.route('POST', `/superset/explore_json/?form_data={"slice_id":${slice.slice_id}}`).as(alias);
        return `@${alias}`;
      });
      // reload the dashboard again with all routes watched.
      cy.visit('/superset/dashboard/births');
      // wait and verify one-by-one
      aliases.forEach((alias) => {
        cy.wait(alias).then((xhr) => {
          expect(xhr.status).to.eq(200);
          expect(xhr.response.body).to.have.property('error', null);
          cy.get(`#slice-container-${xhr.response.body.form_data.slice_id}`);
        });
      });
    });
  });
});
