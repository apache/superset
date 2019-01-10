import PropTypes from 'prop-types';

export default PropTypes.shape({
  column_name: PropTypes.string.isRequired,
  type: PropTypes.string,
});
