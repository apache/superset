export default () => {
  describe('SqlLab query tabs', () => {
    beforeEach(() => {
      cy.login();
      cy.server();
      cy.visit('/superset/sqllab');
    });

    it('allows you to create a tab', () => {
      cy.get('#a11y-query-editor-tabs > ul > li').then((tabList) => {
        const initialTabCount = tabList.length;

        // add tab (second to last tab)
        cy.get('#a11y-query-editor-tabs > ul > li')
          .eq(initialTabCount - 2)
          .click();

        cy.get('#a11y-query-editor-tabs > ul > li').should('have.length', initialTabCount + 1);
      });
    });

    it('allows you to close a tab', () => {
      cy.get('#a11y-query-editor-tabs > ul > li').then((tabListA) => {
        const initialTabCount = tabListA.length;

        // open the tab dropdown to remove
        cy.get('#a11y-query-editor-tabs > ul > li:first button').click();

        // first item is close
        cy.get('#a11y-query-editor-tabs > ul > li:first ul li a')
          .eq(0)
          .click();

        cy.get('#a11y-query-editor-tabs > ul > li').should('have.length', initialTabCount - 1);
      });
    });
  });
};
