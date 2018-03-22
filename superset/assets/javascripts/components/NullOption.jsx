import React from 'react';
import PropTypes from 'prop-types';

import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

const propTypes = {
  option: PropTypes.object.isRequired,
};

export default function NullOption({ option }) {
  if (option.value === null) {
    return (
      <span>
        <span className="m-r-5 option-label">{'NULL'}</span>
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          tooltip="Denotes `null` value for filter (e.g. `where col_name is null`)"
          label="null-value"
        />
      </span>
    );
  }
  return <span>{option.label}</span>;
}

NullOption.propTypes = propTypes;
