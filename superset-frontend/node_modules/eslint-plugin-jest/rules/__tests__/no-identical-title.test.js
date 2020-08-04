'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../no-identical-title');

const ruleTester = new RuleTester();

ruleTester.run('no-identical-title', rule, {
  valid: [
    [
      'describe("describe", function() {',
      '   it("it", function() {});',
      '});',
    ].join('\n'),
    [
      'describe("describe1", function() {',
      '   it("it1", function() {});',
      '   it("it2", function() {});',
      '});',
    ].join('\n'),
    ['it("it1", function() {});', 'it("it2", function() {});'].join('\n'),
    ['it.only("it1", function() {});', 'it("it2", function() {});'].join('\n'),
    ['it.only("it1", function() {});', 'it.only("it2", function() {});'].join(
      '\n'
    ),
    ['describe("title", function() {});', 'it("title", function() {});'].join(
      '\n'
    ),
    [
      'describe("describe1", function() {',
      '   it("it1", function() {});',
      '   describe("describe2", function() {',
      '       it("it1", function() {});',
      '   });',
      '});',
    ].join('\n'),
    [
      'describe("describe1", function() {',
      '   describe("describe2", function() {',
      '       it("it1", function() {});',
      '   });',
      '   it("it1", function() {});',
      '});',
    ].join('\n'),
    [
      'describe("describe1", function() {',
      '   describe("describe2", function() {});',
      '});',
    ].join('\n'),
    [
      'describe("describe1", function() {',
      '   describe("describe2", function() {});',
      '});',
      'describe("describe2", function() {});',
    ].join('\n'),
    [
      'describe("describe1", function() {});',
      'describe("describe2", function() {});',
    ].join('\n'),
    ['it("it" + n, function() {});', 'it("it" + n, function() {});'].join('\n'),
    {
      code: [
        'it(`it${n}`, function() {});',
        'it(`it${n}`, function() {});',
      ].join('\n'),
      env: {
        es6: true,
      },
    },
    [
      'describe("title " + foo, function() {',
      '    describe("describe1", function() {});',
      '});',
      'describe("describe1", function() {});',
    ].join('\n'),
    [
      'describe("describe1", function() {',
      '    describe("describe2", function() {});',
      '    describe("title " + foo, function() {',
      '        describe("describe2", function() {});',
      '    });',
      '});',
    ].join('\n'),
  ],

  invalid: [
    {
      code: [
        'describe("describe1", function() {',
        '   it("it1", function() {});',
        '   it("it1", function() {});',
        '});',
      ].join('\n'),
      errors: [
        {
          message:
            'Test title is used multiple times in the same describe block.',
          column: 4,
          line: 3,
        },
      ],
    },
    {
      code: ['it("it1", function() {});', 'it("it1", function() {});'].join(
        '\n'
      ),
      errors: [
        {
          message:
            'Test title is used multiple times in the same describe block.',
          column: 1,
          line: 2,
        },
      ],
    },
    {
      code: [
        'it.only("it1", function() {});',
        'it("it1", function() {});',
      ].join('\n'),
      errors: [
        {
          message:
            'Test title is used multiple times in the same describe block.',
          column: 1,
          line: 2,
        },
      ],
    },
    {
      code: ['fit("it1", function() {});', 'it("it1", function() {});'].join(
        '\n'
      ),
      errors: [
        {
          message:
            'Test title is used multiple times in the same describe block.',
          column: 1,
          line: 2,
        },
      ],
    },
    {
      code: [
        'it.only("it1", function() {});',
        'it.only("it1", function() {});',
      ].join('\n'),
      errors: [
        {
          message:
            'Test title is used multiple times in the same describe block.',
          column: 1,
          line: 2,
        },
      ],
    },
    {
      code: [
        'describe("describe1", function() {});',
        'describe("describe1", function() {});',
      ].join('\n'),
      errors: [
        {
          message:
            'Describe block title is used multiple times in the same describe block.',
          column: 1,
          line: 2,
        },
      ],
    },
    {
      code: [
        'describe("describe1", function() {});',
        'xdescribe("describe1", function() {});',
      ].join('\n'),
      errors: [
        {
          message:
            'Describe block title is used multiple times in the same describe block.',
          column: 1,
          line: 2,
        },
      ],
    },
    {
      code: [
        'fdescribe("describe1", function() {});',
        'describe("describe1", function() {});',
      ].join('\n'),
      errors: [
        {
          message:
            'Describe block title is used multiple times in the same describe block.',
          column: 1,
          line: 2,
        },
      ],
    },
    {
      code: [
        'describe("describe1", function() {',
        '   describe("describe2", function() {});',
        '});',
        'describe("describe1", function() {});',
      ].join('\n'),
      errors: [
        {
          message:
            'Describe block title is used multiple times in the same describe block.',
          column: 1,
          line: 4,
        },
      ],
    },
  ],
});
