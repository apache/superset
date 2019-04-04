/*
 * @flow
 */
export type ESLintReport = {
  node: any,
  message: string,
};

export type ESLintContext = {
  options: Array<Object>,
  report: (ESLintReport) => void,
};
