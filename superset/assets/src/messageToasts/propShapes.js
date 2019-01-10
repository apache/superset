import PropTypes from 'prop-types';

import {
  INFO_TOAST,
  SUCCESS_TOAST,
  WARNING_TOAST,
  DANGER_TOAST,
} from './constants';

// eslint-disable-next-line import/prefer-default-export
export const toastShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  toastType: PropTypes.oneOf([
    INFO_TOAST,
    SUCCESS_TOAST,
    WARNING_TOAST,
    DANGER_TOAST,
  ]).isRequired,
  text: PropTypes.string.isRequired,
  duration: PropTypes.number,
});
