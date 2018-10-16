import readResponseBlob from '../../utils/readResponseBlob';
import { WORLD_HEALTH_DASHBOARD } from './dashboard.helper';

export default () => describe('load', () => {
  const aliases = [];

  beforeEach(() => {
    cy.server();
    cy.login();

    cy.visit(WORLD_HEALTH_DASHBOARD);

    cy.get('#app').then((data) => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
      const slices = bootstrapData.dashboard_data.slices;
      // then define routes and create alias for each requests
      slices.forEach((slice) => {
        const alias = `getJson_${slice.slice_id}`;
        cy.route('POST', `/superset/explore_json/?form_data={"slice_id":${slice.slice_id}}`).as(alias);
        aliases.push(`@${alias}`);
      });
    });
  });

  it('should load dashboard', () => {
    // wait and verify one-by-one
    cy.wait(aliases).then((requests) => {
      requests.forEach(async (xhr) => {
        expect(xhr.status).to.eq(200);
        const responseBody = await readResponseBlob(xhr.response.body);
        expect(responseBody).to.have.property('error', null);
        cy.get(`#slice-container-${xhr.response.body.form_data.slice_id}`);
      });
    });
  });
});
