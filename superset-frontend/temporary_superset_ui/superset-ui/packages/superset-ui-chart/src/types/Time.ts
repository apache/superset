// eslint-disable-next-line import/prefer-default-export
export type TimeRange = {
  /** Time range of the query [from, to] */
  // eslint-disable-next-line camelcase
  time_range?: string;
  since?: string;
  until?: string;
};
