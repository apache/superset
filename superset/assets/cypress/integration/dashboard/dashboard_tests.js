describe('Load dashboard', () => {
  it('Load birth names dashboard', () => {
    cy.server();
    cy.login();

    cy.visit('/superset/dashboard/births');

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.wait(10000, ['@getJson']);

    let sliceData;

    cy.get('@getJson.all').then((xhrs) => {
      sliceData = xhrs;
      xhrs.forEach((data) => {
        expect(data.status).to.eq(200);
        expect(data.response.body).to.have.property('error', null);
        cy.get(`#slice-container-${data.response.body.form_data.slice_id}`);
      });
      cy.get('#app').then((data) => {
        const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
        expect(bootstrapData.dashboard_data.slices.length).to.eq(sliceData.length);
      });
    });
  });
});
