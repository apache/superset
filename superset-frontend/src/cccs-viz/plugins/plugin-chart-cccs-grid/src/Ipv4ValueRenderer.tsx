import { Component } from 'react';

export default class Ipv4ValueRenderer extends Component<
  {},
  { cellValue: any }
> {
  constructor(props: any) {
    super(props);

    this.state = {
      cellValue: Ipv4ValueRenderer.getValueToDisplay(props),
    };
  }

  // update cellValue when the cell's props are updated
  static getDerivedStateFromProps(nextProps: any) {
    return {
      cellValue: Ipv4ValueRenderer.getValueToDisplay(nextProps),
    };
  }

  formatIpV4(v: any) {
    const converted = `${(v >> 24) & 0xff}.${(v >> 16) & 0xff}.${
      (v >> 8) & 0xff
    }.${v & 0xff}`;
    return converted;
  }

  render() {
    let ipString = this.state.cellValue;
    if (typeof this.state.cellValue === 'number') {
      ipString = this.formatIpV4(this.state.cellValue);
    }

    return ipString;
  }

  static getValueToDisplay(params: { valueFormatted: any; value: any }) {
    return params.valueFormatted ? params.valueFormatted : params.value;
  }
}
