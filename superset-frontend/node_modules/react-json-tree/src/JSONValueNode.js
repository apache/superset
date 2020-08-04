import React from 'react';
import PropTypes from 'prop-types';

/**
 * Renders simple values (eg. strings, numbers, booleans, etc)
 */

const JSONValueNode = ({
  nodeType,
  styling,
  labelRenderer,
  keyPath,
  valueRenderer,
  value,
  valueGetter
}) => (
  <li {...styling('value', nodeType, keyPath)}>
    <label {...styling(['label', 'valueLabel'], nodeType, keyPath)}>
      {labelRenderer(keyPath, nodeType, false, false)}
    </label>
    <span {...styling('valueText', nodeType, keyPath)}>
      {valueRenderer(valueGetter(value), value, ...keyPath)}
    </span>
  </li>
);

JSONValueNode.propTypes = {
  nodeType: PropTypes.string.isRequired,
  styling: PropTypes.func.isRequired,
  labelRenderer: PropTypes.func.isRequired,
  keyPath: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  ).isRequired,
  valueRenderer: PropTypes.func.isRequired,
  value: PropTypes.any,
  valueGetter: PropTypes.func
};

JSONValueNode.defaultProps = {
  valueGetter: value => value
};

export default JSONValueNode;
