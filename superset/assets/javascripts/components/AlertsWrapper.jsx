/* global notify */
import React from 'react';
import AlertContainer from 'react-alert';
import PropTypes from 'prop-types';

const propTypes = {
  initMessages: PropTypes.array,
};
const defaultProps = {
  initMessages: [],
};

export default class AlertsWrapper extends React.PureComponent {
  componentDidMount() {
    this.props.initMessages.forEach((msg) => {
      if (['info', 'error', 'success'].indexOf(msg[0]) >= 0) {
        notify[msg[0]](msg[1]);
      } else {
        notify.show(msg[1]);
      }
    });
  }
  render() {
    return (
      <AlertContainer
        ref={(ref) => {
          global.notify = ref;
        }}
        offset={14}
        position="top right"
        theme="dark"
        time={5000}
        transition="fade"
      />);
  }
}
AlertsWrapper.propTypes = propTypes;
AlertsWrapper.defaultProps = defaultProps;
