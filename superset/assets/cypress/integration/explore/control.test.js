// ***********************************************
// Tests for setting controls in the UI
// ***********************************************

describe('Groupby', () => {
  it('Set groupby', () => {
    cy.server();
    cy.login();

    cy.route('POST', '/superset/explore_json/**').as('getJson');
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@getJson' });

    cy.get('[data-test=groupby]').within(() => {
      cy.get('.Select-control').click();
      cy.get('input.select-input').type('state', { force: true });
      cy.get('.VirtualizedSelectFocusedOption').click();
    });
    cy.get('button.query').click();
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });
});

describe('AdhocMetrics', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('Clear metric and set simple adhoc metric', () => {
    const metricName = 'Girl Births';

    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@getJson' });

    cy.get('[data-test=metrics]').within(() => {
      cy.get('.select-clear').click();
      cy.get('.Select-control').click({ force: true });
      cy.get('input').type('sum_girls', { force: true });
      cy.get('.VirtualizedSelectFocusedOption')
        .trigger('mousedown')
        .click();
    });

    cy.get('#metrics-edit-popover').within(() => {
      cy.get('.popover-title').within(() => {
        cy.get('span').click();
        cy.get('input').type(metricName);
      });
      cy.get('button')
        .contains('Save')
        .click();
    });

    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      querySubstring: metricName,
      chartSelector: 'svg',
    });
  });

  xit('Clear metric and set custom sql adhoc metric', () => {
    const metric = 'SUM(num)/COUNT(DISTINCT name)';

    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@getJson' });

    cy.get('[data-test=metrics]').within(() => {
      cy.get('.select-clear').click();
      cy.get('.Select-control').click({ force: true });
      cy.get('input').type('num', { force: true });
      cy.get('.VirtualizedSelectFocusedOption')
        .trigger('mousedown')
        .click();
    });

    cy.get('#metrics-edit-popover').within(() => {
      cy.get('#adhoc-metric-edit-tabs-tab-SQL').click();
      cy.get('.ace_content').click();
      cy.get('.ace_text-input')
        .type(`{selectall}{backspace}${metric}`, { force: true });
      cy.get('button').contains('Save').click();
    });

    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      querySubstring: metric,
      chartSelector: 'svg',
    });
  });

  it('Switch between simple and custom sql tabs', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@getJson' });

    cy.get('[data-test=metrics]').within(() => {
      cy.get('.select-clear').click();
      cy.get('.Select-control').click({ force: true });
      cy.get('input').type('sum_girls', { force: true });
      cy.get('.VirtualizedSelectFocusedOption')
        .trigger('mousedown')
        .click();
    });

    cy.get('#metrics-edit-popover').within(() => {
      cy.get('#adhoc-metric-edit-tabs-tab-SQL').click();
      cy.get('.ace_identifier').contains('sum_girls');
      cy.get('.ace_content').click();
      cy.get('.ace_text-input')
        .type('{selectall}{backspace}SUM(num)', { force: true });
      cy.get('#adhoc-metric-edit-tabs-tab-SIMPLE').click();
      cy.get('.select-value-label').contains('num');
      cy.get('button').contains('Save').click();
    });

    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      chartSelector: 'svg',
    });
  });
});

describe('AdhocFilters', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('Set simple adhoc filter', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@getJson' });

    cy.get('[data-test=adhoc_filters]').within(() => {
      cy.get('.Select-control').click({ force: true });
      cy.get('input').type('name', { force: true });
      cy.get('.VirtualizedSelectFocusedOption')
        .trigger('mousedown')
        .click();
    });

    cy.get('#filter-edit-popover').within(() => {
      cy.get('[data-test=adhoc-filter-simple-value]').within(() => {
        cy.get('div.select-input').click({ force: true });
        cy.get('input.select-input').type('Amy', { force: true });
        cy.get('.VirtualizedSelectFocusedOption')
          .trigger('mousedown')
          .click();
      });
      cy.get('button')
        .contains('Save')
        .click();
    });

    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      chartSelector: 'svg',
    });
  });

  it('Set custom adhoc filter', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@getJson' });

    cy.get('[data-test=adhoc_filters]').within(() => {
      cy.get('.Select-control').click({ force: true });
      cy.get('input').type('name', { force: true });
      cy.get('.VirtualizedSelectFocusedOption')
        .trigger('mousedown')
        .click();
    });

    cy.get('#filter-edit-popover').within(() => {
      cy.get('#adhoc-filter-edit-tabs-tab-SQL').click();
      cy.get('.ace_content').click();
      cy.get('.ace_text-input')
        .type("'Amy' OR name = 'Bob'", { force: true });
      cy.get('button')
        .contains('Save')
        .click();
    });

    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      chartSelector: 'svg',
    });
  });
});


describe('Advanced analytics', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('Create custom time compare', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@getJson' });

    cy.get('span')
      .contains('Advanced Analytics')
      .siblings()
      .first()
      .click();

    cy.get('[data-test=time_compare]').within(() => {
      cy.get('.Select-control').click({ force: true });
      cy.get('input').type('364 days', { force: true });
      cy.get('.VirtualizedSelectOption')
        .trigger('mousedown')
        .click();
    });

    cy.get('button.query').click();
    cy.wait('@getJson');
    cy.reload();
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      chartSelector: 'svg',
    });

    cy.get('[data-test=time_compare]').within(() => {
      cy.get('.select-value-label').contains('364 days');
    });
  });
});

describe('Annotations', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('Create formula annotation y-axis goal line', () => {
    cy.visitChartByName('Num Births Trend');
    cy.verifySliceSuccess({ waitAlias: '@getJson' });

    cy.get('[data-test=annotation_layers]').within(() => {
      cy.get('button').click();
    });

    cy.get('.popover-content').within(() => {
      cy.get('[data-test=annotation-layer-name-header]').siblings().first().within(() => {
        cy.get('input').type('Goal line');
      });
      cy.get('[data-test=annotation-layer-value-header]').siblings().first().within(() => {
        cy.get('input').type('y=1400000');
      });
      cy.get('button').contains('OK').click();
    });

    cy.get('button.query').click();
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      chartSelector: 'svg',
    });

    cy.get('.nv-legend-text').should('have.length', 2);
  });
});
