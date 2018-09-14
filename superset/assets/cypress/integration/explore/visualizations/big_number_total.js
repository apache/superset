import { FORM_DATA_DEFAULTS, NUM_METRIC } from './shared.helper';

// Big Number Total

describe('Big Number Total', () => {
  const BIG_NUMBER_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'big_number_total' };

  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('Test big number chart with adhoc metric', () => {
    const formData = { ...BIG_NUMBER_DEFAULTS, metric: NUM_METRIC };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', querySubstring: NUM_METRIC.label });
  });

  it('Test big number chart with simple filter', () => {
    const filters = [
      {
        expressionType: 'SIMPLE',
        subject: 'name',
        operator: 'in',
        comparator: ['Aaron', 'Amy', 'Andrea'],
        clause: 'WHERE',
        sqlExpression: null,
        fromFormData: true,
        filterOptionName: 'filter_4y6teao56zs_ebjsvwy48c',
      },
    ];

    const formData = { ...BIG_NUMBER_DEFAULTS, metric: 'count', adhoc_filters: filters };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  });

  it('Test big number chart ignores groupby', () => {
    const formData = { ...BIG_NUMBER_DEFAULTS, metric: NUM_METRIC, groupby: ['state'] };

    cy.visitChartByParams(JSON.stringify(formData));
    cy.wait(['@getJson']).then((data) => {
      cy.verifyResponseCodes(data);
      cy.verifySliceContainer();
      expect(data.response.body.query).not.contains(formData.groupby[0]);
    });
  });
});
