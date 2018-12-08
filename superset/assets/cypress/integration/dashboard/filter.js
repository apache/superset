import { WORLD_HEALTH_DASHBOARD } from './dashboard.helper';

export default () => describe('dashboard filter', () => {
  let sliceIds = [];
  let filterId;

  beforeEach(() => {
    cy.server();
    cy.login();

    cy.visit(WORLD_HEALTH_DASHBOARD);

    cy.get('#app').then((data) => {
      const bootstrapData = JSON.parse(data[0].dataset.bootstrap);
      const dashboard = bootstrapData.dashboard_data;
      sliceIds = dashboard.slices.map(slice => (slice.slice_id));
      filterId = dashboard.slices.find(slice => (slice.form_data.viz_type === 'filter_box')).slice_id;
    });
  });

  it('should apply filter', () => {
    const aliases = [];

    const filterRoute = `/superset/explore_json/?form_data={"slice_id":${filterId}}`;
    cy.route('POST', filterRoute).as('fetchFilter');
    cy.wait('@fetchFilter');
    sliceIds
      .filter(id => (parseInt(id, 10) !== filterId))
      .forEach((id) => {
        const alias = `getJson_${id}`;
        aliases.push(`@${alias}`);

        cy.route('POST', `/superset/explore_json/?form_data={"slice_id":${id}}`).as(alias);
      });

    // select filter_box and apply
    cy.get('.Select-control')
      .first().find('input')
      .first()
      .type('South Asia{enter}', { force: true });

    cy.wait(aliases).then((requests) => {
      requests.forEach((xhr) => {
        const requestFormData = xhr.request.body;
        const requestParams = JSON.parse(requestFormData.get('form_data'));
        expect(requestParams.extra_filters[0])
          .deep.eq({ col: 'region', op: 'in', val: ['South Asia'] });
      });
    });
  });
});
