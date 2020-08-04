import PropTypes from 'prop-types';

const icons = PropTypes.shape({
    check: PropTypes.node,
    uncheck: PropTypes.node,
    halfCheck: PropTypes.node,
    expandClose: PropTypes.node,
    expandOpen: PropTypes.node,
    expandAll: PropTypes.node,
    collapseAll: PropTypes.node,
    parentClose: PropTypes.node,
    parentOpen: PropTypes.node,
    leaf: PropTypes.node,
});

export default icons;
