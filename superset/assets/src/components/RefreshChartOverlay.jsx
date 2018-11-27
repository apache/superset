import React from 'react';
import PropTypes from 'prop-types';
import { t } from '@superset-ui/translation';
import Button from '../components/Button';

const propTypes = {
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  onQuery: PropTypes.func,
  onDismiss: PropTypes.func,
};

class RefreshChartOverlay extends React.PureComponent {
  render() {
    return (
      <div
        style={{ height: this.props.height, width: this.props.width }}
        className="explore-chart-overlay"
      >
        <div>
          <Button
            className="refresh-overlay-btn"
            onClick={this.props.onQuery}
            bsStyle="primary"
          >
            {t('Run Query')}
          </Button>
          <Button
            className="dismiss-overlay-btn"
            onClick={this.props.onDismiss}
          >
            {t('Dismiss')}
          </Button>
        </div>
      </div>
    );
  }
}

RefreshChartOverlay.propTypes = propTypes;

export default RefreshChartOverlay;
