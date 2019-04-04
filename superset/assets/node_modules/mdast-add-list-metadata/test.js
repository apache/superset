const test = require('tape');
const unified = require('unified');
const remarkParse = require('remark-parse');
const inspect = require('unist-util-inspect');
const addListMetadata = require('./index');

test('it converts adds depth to list nodes, index and ordered to items', t => {
  t.plan(2);

  const markdown = `
# Title

- First
- Second
  - a
- Third
`;

  const actualInput = unified()
    .use(remarkParse, {commonmark: true})
    .parse(markdown);

  console.log(inspect(actualInput));

  const expectedInput = {
    type: 'root',
    children: [
      {
        type: 'heading',
        depth: 1,
        children: [
          {
            type: 'text',
            value: 'Title',
            position: {
              start: {line: 2, column: 3, offset: 3},
              end: {line: 2, column: 8, offset: 8},
              indent: [],
            },
          },
        ],
        position: {
          start: {line: 2, column: 1, offset: 1},
          end: {line: 2, column: 8, offset: 8},
          indent: [],
        },
      },
      {
        type: 'list',
        ordered: false,
        start: null,
        loose: false,
        children: [
          {
            type: 'listItem',
            loose: false,
            checked: null,
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    value: 'First',
                    position: {
                      start: {line: 4, column: 3, offset: 12},
                      end: {line: 4, column: 8, offset: 17},
                      indent: [],
                    },
                  },
                ],
                position: {
                  start: {line: 4, column: 3, offset: 12},
                  end: {line: 4, column: 8, offset: 17},
                  indent: [],
                },
              },
            ],
            position: {
              start: {line: 4, column: 1, offset: 10},
              end: {line: 4, column: 8, offset: 17},
              indent: [],
            },
          },
          {
            type: 'listItem',
            loose: false,
            checked: null,
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    value: 'Second',
                    position: {
                      start: {line: 5, column: 3, offset: 20},
                      end: {line: 5, column: 9, offset: 26},
                      indent: [],
                    },
                  },
                ],
                position: {
                  start: {line: 5, column: 3, offset: 20},
                  end: {line: 5, column: 9, offset: 26},
                  indent: [],
                },
              },
              {
                type: 'list',
                ordered: false,
                start: null,
                loose: false,
                children: [
                  {
                    type: 'listItem',
                    loose: false,
                    checked: null,
                    children: [
                      {
                        type: 'paragraph',
                        children: [
                          {
                            type: 'text',
                            value: 'a',
                            position: {
                              start: {line: 6, column: 5, offset: 31},
                              end: {line: 6, column: 6, offset: 32},
                              indent: [],
                            },
                          },
                        ],
                        position: {
                          start: {line: 6, column: 5, offset: 31},
                          end: {line: 6, column: 6, offset: 32},
                          indent: [],
                        },
                      },
                    ],
                    position: {
                      start: {line: 6, column: 3, offset: 29},
                      end: {line: 6, column: 6, offset: 32},
                      indent: [],
                    },
                  },
                ],
                position: {
                  start: {line: 6, column: 3, offset: 29},
                  end: {line: 6, column: 6, offset: 32},
                  indent: [],
                },
              },
            ],
            position: {
              start: {line: 5, column: 1, offset: 18},
              end: {line: 6, column: 6, offset: 32},
              indent: [1],
            },
          },
          {
            type: 'listItem',
            loose: false,
            checked: null,
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    value: 'Third',
                    position: {
                      start: {line: 7, column: 3, offset: 35},
                      end: {line: 7, column: 8, offset: 40},
                      indent: [],
                    },
                  },
                ],
                position: {
                  start: {line: 7, column: 3, offset: 35},
                  end: {line: 7, column: 8, offset: 40},
                  indent: [],
                },
              },
            ],
            position: {
              start: {line: 7, column: 1, offset: 33},
              end: {line: 7, column: 8, offset: 40},
              indent: [],
            },
          },
        ],
        position: {
          start: {line: 4, column: 1, offset: 10},
          end: {line: 7, column: 8, offset: 40},
          indent: [1, 1, 1],
        },
      },
    ],
    position: {
      start: {line: 1, column: 1, offset: 0},
      end: {line: 8, column: 1, offset: 41},
    },
  };
  t.deepEquals(actualInput, expectedInput, 'input looks good');

  const actualOutput = addListMetadata()(actualInput);

  console.log(inspect(actualOutput));

  const expectedOutput = {
    type: 'root',
    children: [
      {
        type: 'heading',
        depth: 1,
        children: [
          {
            type: 'text',
            value: 'Title',
            position: {
              start: {line: 2, column: 3, offset: 3},
              end: {line: 2, column: 8, offset: 8},
              indent: [],
            },
          },
        ],
        position: {
          start: {line: 2, column: 1, offset: 1},
          end: {line: 2, column: 8, offset: 8},
          indent: [],
        },
      },
      {
        type: 'list',
        ordered: false,
        start: null,
        loose: false,
        children: [
          {
            type: 'listItem',
            loose: false,
            checked: null,
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    value: 'First',
                    position: {
                      start: {line: 4, column: 3, offset: 12},
                      end: {line: 4, column: 8, offset: 17},
                      indent: [],
                    },
                  },
                ],
                position: {
                  start: {line: 4, column: 3, offset: 12},
                  end: {line: 4, column: 8, offset: 17},
                  indent: [],
                },
              },
            ],
            position: {
              start: {line: 4, column: 1, offset: 10},
              end: {line: 4, column: 8, offset: 17},
              indent: [],
            },
            index: 0,
            ordered: false,
          },
          {
            type: 'listItem',
            loose: false,
            checked: null,
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    value: 'Second',
                    position: {
                      start: {line: 5, column: 3, offset: 20},
                      end: {line: 5, column: 9, offset: 26},
                      indent: [],
                    },
                  },
                ],
                position: {
                  start: {line: 5, column: 3, offset: 20},
                  end: {line: 5, column: 9, offset: 26},
                  indent: [],
                },
              },
              {
                type: 'list',
                ordered: false,
                start: null,
                loose: false,
                children: [
                  {
                    type: 'listItem',
                    loose: false,
                    checked: null,
                    children: [
                      {
                        type: 'paragraph',
                        children: [
                          {
                            type: 'text',
                            value: 'a',
                            position: {
                              start: {line: 6, column: 5, offset: 31},
                              end: {line: 6, column: 6, offset: 32},
                              indent: [],
                            },
                          },
                        ],
                        position: {
                          start: {line: 6, column: 5, offset: 31},
                          end: {line: 6, column: 6, offset: 32},
                          indent: [],
                        },
                      },
                    ],
                    position: {
                      start: {line: 6, column: 3, offset: 29},
                      end: {line: 6, column: 6, offset: 32},
                      indent: [],
                    },
                    index: 0,
                    ordered: false,
                  },
                ],
                position: {
                  start: {line: 6, column: 3, offset: 29},
                  end: {line: 6, column: 6, offset: 32},
                  indent: [],
                },
                depth: 1,
              },
            ],
            position: {
              start: {line: 5, column: 1, offset: 18},
              end: {line: 6, column: 6, offset: 32},
              indent: [1],
            },
            index: 1,
            ordered: false,
          },
          {
            type: 'listItem',
            loose: false,
            checked: null,
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    value: 'Third',
                    position: {
                      start: {line: 7, column: 3, offset: 35},
                      end: {line: 7, column: 8, offset: 40},
                      indent: [],
                    },
                  },
                ],
                position: {
                  start: {line: 7, column: 3, offset: 35},
                  end: {line: 7, column: 8, offset: 40},
                  indent: [],
                },
              },
            ],
            position: {
              start: {line: 7, column: 1, offset: 33},
              end: {line: 7, column: 8, offset: 40},
              indent: [],
            },
            index: 2,
            ordered: false,
          },
        ],
        position: {
          start: {line: 4, column: 1, offset: 10},
          end: {line: 7, column: 8, offset: 40},
          indent: [1, 1, 1],
        },
        depth: 0,
      },
    ],
    position: {
      start: {line: 1, column: 1, offset: 0},
      end: {line: 8, column: 1, offset: 41},
    },
  };

  t.deepEquals(actualOutput, expectedOutput, 'output looks good');
});
