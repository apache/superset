import PropTypes from 'prop-types';

export default PropTypes.shape({
  metric_name: PropTypes.string.isRequired,
  expression: PropTypes.string.isRequired,
});
