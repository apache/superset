import PropTypes from 'prop-types';
import componentTypes from './componentTypes';
import backgroundStyleOptions from './backgroundStyleOptions';
import headerStyleOptions from './headerStyleOptions';
import { INFO_TOAST, SUCCESS_TOAST, WARNING_TOAST, DANGER_TOAST } from './constants';

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
    background: PropTypes.oneOf(backgroundStyleOptions.map(opt => opt.value)),
  }),
});

export const toastShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  toastType: PropTypes.oneOf([INFO_TOAST, SUCCESS_TOAST, WARNING_TOAST, DANGER_TOAST]).isRequired,
  text: PropTypes.string.isRequired,
});
