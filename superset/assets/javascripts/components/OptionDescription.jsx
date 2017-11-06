import React from 'react';
import PropTypes from 'prop-types';

import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

const propTypes = {
  option: PropTypes.object.isRequired,
};

// This component provides a general tooltip for options
// in a SelectControl
export default function OptionDescription({ option }) {
  return (
    <span>
      <span className="m-r-5 option-label">
        {option.label}
      </span>
      {option.description &&
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="question-circle-o"
          tooltip={option.description}
          label={`descr-${option.label}`}
        />
      }
    </span>);
}
OptionDescription.propTypes = propTypes;
