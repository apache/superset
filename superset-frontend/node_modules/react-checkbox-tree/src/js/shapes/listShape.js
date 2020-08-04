import PropTypes from 'prop-types';

const listShape = PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.string),
    PropTypes.arrayOf(PropTypes.number),
]);

export default listShape;
