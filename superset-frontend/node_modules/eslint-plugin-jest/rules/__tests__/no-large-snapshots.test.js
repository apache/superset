'use strict';

const RuleTester = require('eslint').RuleTester;
const rule = require('../no-large-snapshots');
const noLargeSnapshots = rule.create;

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2015,
  },
});

ruleTester.run('no-large-snapshots', rule, {
  valid: [
    {
      filename: 'mock.js',
      code: `expect(something).toMatchInlineSnapshot(\`\n${'line\n'.repeat(
        2
      )}\`);`,
    },
    {
      filename: 'mock.js',
      code: `expect(something).toThrowErrorMatchingInlineSnapshot(\`\n${'line\n'.repeat(
        2
      )}\`);`,
    },
  ],
  invalid: [
    {
      filename: 'mock.js',
      code: `expect(something).toMatchInlineSnapshot(\`\n${'line\n'.repeat(
        50
      )}\`);`,
      errors: [
        {
          message:
            'Expected Jest snapshot to be smaller than 50 lines but was 51 lines long',
        },
      ],
    },
    {
      filename: 'mock.js',
      code: `expect(something).toThrowErrorMatchingInlineSnapshot(\`\n${'line\n'.repeat(
        50
      )}\`);`,
      errors: [
        {
          message:
            'Expected Jest snapshot to be smaller than 50 lines but was 51 lines long',
        },
      ],
    },
  ],
});

// was not able to use https://eslint.org/docs/developer-guide/nodejs-api#ruletester for these because there is no way to configure RuleTester to run non .js files
describe('no-large-snapshots', () => {
  it('should return an empty object for non snapshot files', () => {
    const mockContext = {
      getFilename: () => 'mock-component.jsx',
      options: [],
    };
    const result = noLargeSnapshots(mockContext);

    expect(result).toEqual({});
  });

  it('should return an object with an ExpressionStatement function for snapshot files', () => {
    const mockContext = {
      getFilename: () => 'mock-component.jsx.snap',
      options: [],
    };

    const result = noLargeSnapshots(mockContext);

    expect(result).toMatchObject({
      ExpressionStatement: expect.any(Function),
    });
  });

  describe('ExpressionStatement function', () => {
    it('should report if node has more than 50 lines of code and no sizeThreshold option is passed', () => {
      const mockReport = jest.fn();
      const mockContext = {
        getFilename: () => 'mock-component.jsx.snap',
        options: [],
        report: mockReport,
      };
      const mockNode = {
        loc: {
          start: {
            line: 1,
          },
          end: {
            line: 53,
          },
        },
      };
      noLargeSnapshots(mockContext).ExpressionStatement(mockNode);

      expect(mockReport).toHaveBeenCalledTimes(1);
      expect(mockReport.mock.calls[0]).toMatchSnapshot();
    });

    it('should report if node has more lines of code than number given in sizeThreshold option', () => {
      const mockReport = jest.fn();
      const mockContext = {
        getFilename: () => 'mock-component.jsx.snap',
        options: [{ maxSize: 70 }],
        report: mockReport,
      };
      const mockNode = {
        loc: {
          start: {
            line: 20,
          },
          end: {
            line: 103,
          },
        },
      };
      noLargeSnapshots(mockContext).ExpressionStatement(mockNode);

      expect(mockReport).toHaveBeenCalledTimes(1);
      expect(mockReport.mock.calls[0]).toMatchSnapshot();
    });

    it('should report if maxSize is zero', () => {
      const mockReport = jest.fn();
      const mockContext = {
        getFilename: () => 'mock-component.jsx.snap',
        options: [{ maxSize: 0 }],
        report: mockReport,
      };
      const mockNode = {
        loc: {
          start: {
            line: 1,
          },
          end: {
            line: 2,
          },
        },
      };
      noLargeSnapshots(mockContext).ExpressionStatement(mockNode);

      expect(mockReport).toHaveBeenCalledTimes(1);
      expect(mockReport.mock.calls[0]).toMatchSnapshot();
    });

    it('should not report if node has fewer lines of code than limit', () => {
      const mockReport = jest.fn();
      const mockContext = {
        getFilename: () => 'mock-component.jsx.snap',
        options: [],
        report: mockReport,
      };
      const mockNode = {
        loc: {
          start: {
            line: 1,
          },
          end: {
            line: 18,
          },
        },
      };
      noLargeSnapshots(mockContext).ExpressionStatement(mockNode);

      expect(mockReport).not.toHaveBeenCalled();
    });
  });
});
