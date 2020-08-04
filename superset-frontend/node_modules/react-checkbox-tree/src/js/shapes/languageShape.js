import PropTypes from 'prop-types';

export default PropTypes.shape({
    collapseAll: PropTypes.string.isRequired,
    expandAll: PropTypes.string.isRequired,
    toggle: PropTypes.string.isRequired,
});
