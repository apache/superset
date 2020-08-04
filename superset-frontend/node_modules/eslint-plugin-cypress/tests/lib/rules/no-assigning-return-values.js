'use strict'

const rule = require('../../../lib/rules/no-assigning-return-values')
const RuleTester = require('eslint').RuleTester

const ruleTester = new RuleTester()

const errors = [{ messageId: 'unexpected' }]
const parserOptions = { ecmaVersion: 6 }

ruleTester.run('no-assigning-return-values', rule, {
  valid: [
    { code: 'var foo = true;', parserOptions },
    { code: 'let foo = true;', parserOptions },
    { code: 'const foo = true;', parserOptions },
    { code: 'const foo = bar();', parserOptions },
    { code: 'const foo = bar().baz();', parserOptions },
    { code: 'const spy = cy.spy();', parserOptions },
    { code: 'const stub = cy.stub();', parserOptions },
    { code: 'const result = cy.now();', parserOptions },
    { code: 'const state = cy.state();', parserOptions },
    { code: 'cy.get("foo");', parserOptions },
    { code: 'cy.contains("foo").click();', parserOptions },
  ],

  invalid: [
    { code: 'let a = cy.get("foo")', parserOptions, errors },
    { code: 'const a = cy.get("foo")', parserOptions, errors },
    { code: 'var a = cy.get("foo")', parserOptions, errors },

    { code: 'let a = cy.contains("foo")', parserOptions, errors },
    { code: 'let a = cy.window()', parserOptions, errors },
    { code: 'let a = cy.wait("@something")', parserOptions, errors },

    { code: 'let a = cy.contains("foo").click()', parserOptions, errors },
  ],
})
