describe('SqlLab query tabs', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.visit('/superset/sqllab');
  });

  it('allows you to create a tab', () => {
    cy.get('#a11y-query-editor-tabs > ul > li').then((tabList) => {
      const initialTabCount = tabList.length;

      // add tab
      cy.get('#a11y-query-editor-tabs > ul > li')
        .last()
        .click()
        .then(() => {
          cy.get('#a11y-query-editor-tabs > ul > li').should('have.length', initialTabCount + 1);
        });
    });
  });

  it('allows you to close a tab', () => {
    cy.get('#a11y-query-editor-tabs > ul > li').then((tabListA) => {
      const initialTabCount = tabListA.length;

      // open the tab dropdown
      cy.get('#a11y-query-editor-tabs > ul > li:first button')
        .click()
        .then(() => {
          cy.get('#a11y-query-editor-tabs > ul > li:first ul li a')
            .eq(0) // first is close
            .click()
            .then(() => {
              cy.get('#a11y-query-editor-tabs > ul > li').should(
                'have.length',
                initialTabCount - 1,
              );
            });
        });
    });
  });
});
