import React from 'react';
import AlertContainer from 'react-alert';

export default class AlertsWrapper extends React.PureComponent {
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
