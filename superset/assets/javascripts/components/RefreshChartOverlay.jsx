import React from 'react';
import PropTypes from 'prop-types';
import Button from '../components/Button';
import Link from '../SqlLab/components/Link';

const propTypes = {
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  errorMessage: PropTypes.node,
  onQuery: PropTypes.func,
  onDismiss: PropTypes.func,
};

class RefreshChartOverlay extends React.PureComponent {
  render() {
    return (
      <div
        style={{ height: this.props.height, width: this.props.width }}
        className="refresh-chart-overlay"
      >
        <div>
          <Button
            className="query"
            onClick={this.props.onQuery}
            disabled={!!this.props.errorMessage}
            bsStyle={this.props.errorMessage ? 'danger' : 'primary'}
          >
            <i className="fa fa-bolt" /> Refresh Chart
          </Button>
          <div><Link onClick={this.props.onDismiss}>(dismiss)</Link></div>
        </div>
      </div>
    );
  }
}

RefreshChartOverlay.propTypes = propTypes;

export default RefreshChartOverlay;
