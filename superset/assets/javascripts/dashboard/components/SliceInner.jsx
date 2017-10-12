import React from 'react';
import PropTypes from 'prop-types';
import $ from 'jquery';

const propTypes = {
  containerId: PropTypes.string,
  vizType: PropTypes.string,
  height: PropTypes.func,
  width: PropTypes.func,
};

class SliceInner extends React.PureComponent {
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
    //
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

SliceInner.propTypes = propTypes;

export default SliceInner;
