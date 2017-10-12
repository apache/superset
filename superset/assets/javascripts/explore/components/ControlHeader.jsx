import React from 'react';
import PropTypes from 'prop-types';
import { ControlLabel, OverlayTrigger, Tooltip } from 'react-bootstrap';
import InfoTooltipWithTrigger from '../../components/InfoTooltipWithTrigger';
import { t } from '../../locales';

const propTypes = {
  label: PropTypes.string,
  description: PropTypes.string,
  validationErrors: PropTypes.array,
  renderTrigger: PropTypes.bool,
  rightNode: PropTypes.node,
  leftNode: PropTypes.node,
  onClick: PropTypes.func,
  hovered: PropTypes.bool,
};

const defaultProps = {
  validationErrors: [],
  renderTrigger: false,
  hovered: false,
};

export default class ControlHeader extends React.Component {
  renderOptionalIcons() {
    if (this.props.hovered) {
      return (
        <span>
          {this.props.description &&
            <span>
              <InfoTooltipWithTrigger
                label={t('description')}
                tooltip={this.props.description}
                placement="top"
              />
              {' '}
            </span>
          }
          {this.props.renderTrigger &&
            <span>
              <InfoTooltipWithTrigger
                label={t('bolt')}
                tooltip={t('Changing this control takes effect instantly')}
                placement="top"
                icon="bolt"
              />
              {' '}
            </span>
          }
        </span>);
    }
    return null;
  }
  render() {
    if (!this.props.label) {
      return null;
    }
    const labelClass = (this.props.validationErrors.length > 0) ? 'text-danger' : '';
    return (
      <div
        className="ControlHeader"
      >
        <div className="pull-left">
          <ControlLabel>
            {this.props.leftNode &&
              <span>{this.props.leftNode}</span>
            }
            <span
              onClick={this.props.onClick}
              className={labelClass}
              style={{ cursor: this.props.onClick ? 'pointer' : '' }}
            >
              {this.props.label}
            </span>
            {' '}
            {(this.props.validationErrors.length > 0) &&
              <span>
                <OverlayTrigger
                  placement="top"
                  overlay={
                    <Tooltip id={'error-tooltip'}>
                      {this.props.validationErrors.join(' ')}
                    </Tooltip>
                  }
                >
                  <i className="fa fa-exclamation-circle text-danger" />
                </OverlayTrigger>
                {' '}
              </span>
            }
            {this.renderOptionalIcons()}
          </ControlLabel>
        </div>
        {this.props.rightNode &&
          <div className="pull-right">
            {this.props.rightNode}
          </div>
        }
        <div className="clearfix" />
      </div>
    );
  }
}

ControlHeader.propTypes = propTypes;
ControlHeader.defaultProps = defaultProps;
