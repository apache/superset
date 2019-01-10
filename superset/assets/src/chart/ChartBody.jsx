import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  containerId: PropTypes.string.isRequired,
  vizType: PropTypes.string.isRequired,
  height: PropTypes.func.isRequired,
  width: PropTypes.func.isRequired,
  faded: PropTypes.bool,
};

class ChartBody extends React.PureComponent {
  height() {
    return this.props.height();
  }

  width() {
    return this.props.width();
  }

  render() {
    return (
      <div
        id={this.props.containerId}
        className={`slice_container ${this.props.vizType}${this.props.faded ? ' faded' : ''}`}
        ref={(el) => { this.el = el; }}
      />
    );
  }
}

ChartBody.propTypes = propTypes;

export default ChartBody;
