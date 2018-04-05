import PropTypes from 'prop-types';

import { AGGREGATES } from '../constants';
import columnType from './columnType';

export default PropTypes.shape({
  column: columnType.isRequired,
  aggregate: PropTypes.oneOf(Object.keys(AGGREGATES)).isRequired,
  label: PropTypes.string.isRequired,
});
