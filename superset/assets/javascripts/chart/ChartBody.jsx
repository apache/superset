import React from 'react';
import PropTypes from 'prop-types';
import $ from 'jquery';

const propTypes = {
  containerId: PropTypes.string.isRequired,
  vizType: PropTypes.string.isRequired,
  height: PropTypes.func.isRequired,
  width: PropTypes.func.isRequired,
};

class ChartBody extends React.PureComponent {
  html(data) {
    this.el.innerHTML = data;
  }

  css(property, value) {
    this.el.style[property] = value;
  }

  get(n) {
    return $(this.el).get(n);
  }

  find(classname) {
    return $(this.el).find(classname);
  }

  show() {
    return $(this.el).show();
  }

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
        className={`slice_container ${this.props.vizType}`}
        ref={(el) => { this.el = el; }}
      />
    );
  }
}

ChartBody.propTypes = propTypes;

export default ChartBody;
