import React, { PropTypes } from 'react';
import fieldMap from './controls';
import ControlLabelWithTooltip from './controls/ControlLabelWithTooltip';

const propTypes = {
  name: PropTypes.string.isRequired,
  type: PropTypes.oneOf(Object.keys(fieldMap)).isRequired,
  label: PropTypes.string.isRequired,
  description: PropTypes.string,
  places: PropTypes.number,
  validators: PropTypes.any,
  onChange: React.PropTypes.func,
};

const defaultProps = {
  onChange: () => {},
};

function FieldContainer(props) {
  const FieldType = fieldMap[props.type];
  return (
    <div>
      <ControlLabelWithTooltip
        label={props.label}
        description={props.description}
      />
      <FieldType {...props} />
    </div>
  );
}

FieldContainer.propTypes = propTypes;
FieldContainer.defaultProps = defaultProps;

export default FieldContainer;
