import React, { PropTypes } from 'react';
import { ControlLabel, OverlayTrigger, Tooltip } from 'react-bootstrap';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';

const propTypes = {
  label: PropTypes.string.isRequired,
  description: PropTypes.string,
  validationErrors: PropTypes.array,
  renderTrigger: PropTypes.bool,
  rightNode: PropTypes.node,
};

const defaultProps = {
  validationErrors: [],
  renderTrigger: false,
};

export default function ControlHeader({
    label, description, validationErrors, renderTrigger, rightNode }) {
  const hasError = (validationErrors.length > 0);
  return (
    <div>
      <div className="pull-left">
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
            <span>
              <InfoTooltipWithTrigger label={label} tooltip={description} />
              {' '}
            </span>
          }
          {renderTrigger &&
            <span>
              <OverlayTrigger
                placement="right"
                overlay={
                  <Tooltip id={'rendertrigger-tooltip'}>
                    Takes effect on chart immediatly
                  </Tooltip>
                }
              >
                <i className="fa fa-bolt text-muted" />
              </OverlayTrigger>
              {' '}
            </span>
          }
        </ControlLabel>
      </div>
      {rightNode &&
        <div className="pull-right">
          {rightNode}
        </div>
      }
      <div className="clearfix" />
    </div>
  );
}

ControlHeader.propTypes = propTypes;
ControlHeader.defaultProps = defaultProps;
