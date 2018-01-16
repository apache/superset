import PropTypes from 'prop-types';
import componentTypes from './componentTypes';
import rowStyleOptions from './rowStyleOptions';
import headerStyleOptions from './headerStyleOptions';

export const componentShape = PropTypes.shape({ // eslint-disable-line
  id: PropTypes.string.isRequired,
  type: PropTypes.oneOf(
    Object.values(componentTypes),
  ).isRequired,
  children: PropTypes.arrayOf(PropTypes.string),
  meta: PropTypes.shape({
    // Dimensions
    width: PropTypes.number,
    height: PropTypes.number,

    // Header
    text: PropTypes.string,
    headerSize: PropTypes.oneOf(headerStyleOptions.map(opt => opt.value)),

    // Row
    rowStyle: PropTypes.oneOf(rowStyleOptions.map(opt => opt.value)),
  }),
});
