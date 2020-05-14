export type TimeFormatFunction = (value: Date) => string;

export type TimeGranularity =
  | 'date'
  | 'PT1S'
  | 'PT1M'
  | 'PT5M'
  | 'PT10M'
  | 'PT15M'
  | 'PT0.5H'
  | 'PT1H'
  | 'P1D'
  | 'P1W'
  | 'P1M'
  | 'P0.25Y'
  | 'P1Y'
  | '1969-12-28T00:00:00Z/P1W'
  | '1969-12-29T00:00:00Z/P1W'
  | 'P1W/1970-01-03T00:00:00Z'
  | 'P1W/1970-01-04T00:00:00Z';
