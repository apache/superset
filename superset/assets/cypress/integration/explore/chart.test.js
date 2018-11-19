import { FORM_DATA_DEFAULTS, NUM_METRIC } from './visualizations/shared.helper';
import readResponseBlob from '../../utils/readResponseBlob';

describe('Error', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('No data error message shows up', () => {
    const formData = {
      ...FORM_DATA_DEFAULTS,
      metrics: [NUM_METRIC],
      viz_type: 'line',
      adhoc_filters: [{
        expressionType: 'SIMPLE',
        subject: 'state',
        operator: 'in',
        comparator: ['Fake State'],
        clause: 'WHERE',
        sqlExpression: null,
        fromFormData: true,
      }],
    };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.wait('@getJson').then(async (xhr) => {
      expect(xhr.status).to.eq(400);

      const responseBody = await readResponseBlob(xhr.response.body);

      if (responseBody.error) {
        expect(responseBody.error).to.eq('No data');
      }
    });
    cy.get('div.alert').contains('No data');
  });
});
