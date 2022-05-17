import React, { Component } from 'react';

export default class CustomTooltip extends Component<
  {
    rowIndex: any;
    api: any;
    color: any;
  },
  {}
> {
  getReactContainerClasses() {
    return ['custom-tooltip'];
  }

  render() {
    const { data } = this.props.api.getDisplayedRowAtIndex(this.props.rowIndex);
    return (
      <div
        className="custom-tooltip"
        style={{ backgroundColor: this.props.color || 'white' }}
      >
        <p>
          <span>{data.athlete}</span>
        </p>
        <p>
          <span>Country: </span> {data.SRC_IP}
        </p>
        <p>
          <span>Total: </span> {data.SRC_PORT}
        </p>
      </div>
    );
  }
}
