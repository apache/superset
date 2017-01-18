import React, { PropTypes } from 'react';
import { ControlLabel, OverlayTrigger, Tooltip } from 'react-bootstrap';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';

const propTypes = {
  label: PropTypes.string.isRequired,
  description: PropTypes.string,
  validationErrors: PropTypes.array,
};

const defaultProps = {
  description: null,
  validationErrors: [],
};

export default function ControlHeader({ label, description, validationErrors }) {
  const hasError = (validationErrors.length > 0);
  return (
    <ControlLabel>
      {hasError ?
        <strong className="text-danger">{label}</strong> :
        <span>{label}</span>
      }
      {' '}
      {(validationErrors.length > 0) &&
        <span>
          <OverlayTrigger
            placement="right"
            overlay={
              <Tooltip id={'error-tooltip'}>
                {validationErrors.join(' ')}
              </Tooltip>
            }
          >
            <i className="fa fa-exclamation-circle text-danger" />
          </OverlayTrigger>
          {' '}
        </span>
      }
      {description &&
        <InfoTooltipWithTrigger label={label} tooltip={description} />
      }
    </ControlLabel>
  );
}

ControlHeader.propTypes = propTypes;
ControlHeader.defaultProps = defaultProps;
