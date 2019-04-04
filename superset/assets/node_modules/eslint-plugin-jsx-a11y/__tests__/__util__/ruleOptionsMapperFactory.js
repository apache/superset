/**
 * @flow
 */

type ESLintTestRunnerTestCase = {
  code: string,
  errors: ?Array<{
    message: string,
    type: string,
  }>,
  options: ?Array<mixed>,
  parserOptions: ?Array<mixed>,
};

export default function ruleOptionsMapperFactory(
  ruleOptions: Array<mixed> = [],
) {
  return ({
    code,
    errors,
    options,
    parserOptions,
  }: ESLintTestRunnerTestCase): ESLintTestRunnerTestCase => ({
    code,
    errors,
    options: (options || []).concat(ruleOptions),
    parserOptions,
  });
}
