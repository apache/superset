import PropTypes from 'prop-types';

const nodeShape = {
    label: PropTypes.node.isRequired,
    value: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
    ]).isRequired,

    disabled: PropTypes.bool,
    icon: PropTypes.node,
    showCheckbox: PropTypes.bool,
    title: PropTypes.string,
};

const nodeShapeWithChildren = PropTypes.oneOfType([
    PropTypes.shape(nodeShape),
    PropTypes.shape({
        ...nodeShape,
        children: PropTypes.arrayOf(nodeShape).isRequired,
    }),
]);

export default nodeShapeWithChildren;
