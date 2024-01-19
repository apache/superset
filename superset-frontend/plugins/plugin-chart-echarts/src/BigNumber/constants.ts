// DODO was here
import { t } from '@superset-ui/core';

import { COMPARATOR } from './types';

const MULTIPLE_VALUE_COMPARATORS = [
  COMPARATOR.BETWEEN,
  COMPARATOR.BETWEEN_OR_EQUAL,
  COMPARATOR.BETWEEN_OR_LEFT_EQUAL,
  COMPARATOR.BETWEEN_OR_RIGHT_EQUAL,
];

const PROPORTION = {
  // text size: proportion of the chart container sans trendline
  KICKER: 0.1,
  HEADER: 0.3,
  SUBHEADER: 0.125,
  // trendline size: proportion of the whole chart container
  TRENDLINE: 0.3,
};

const NO_DATA_OR_HASNT_LANDED = t(
  'No data after filtering or data is NULL for the latest time record',
);
const NO_DATA = t(
  'Try applying different filters or ensuring your datasource has data',
);

const DEFAULT_COLOR = '#000';

export {
  MULTIPLE_VALUE_COMPARATORS,
  PROPORTION,
  NO_DATA_OR_HASNT_LANDED,
  NO_DATA,
  DEFAULT_COLOR,
};
