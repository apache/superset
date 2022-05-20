import React, { Component } from 'react';
// import { IPv6 } from "ip-num";
// import bigInt from "big-integer";

export default class Ipv6ValueRenderer extends Component<
  {},
  { cellValue: any }
> {
  constructor(props: any) {
    super(props);

    this.state = {
      cellValue: Ipv6ValueRenderer.getValueToDisplay(props),
    };
  }

  // update cellValue when the cell's props are updated
  static getDerivedStateFromProps(nextProps: any) {
    return {
      cellValue: Ipv6ValueRenderer.getValueToDisplay(nextProps),
    };
  }

  render() {
    //    const ipv6 = IPv6.fromBigInteger(bigInt(this.state.cellValue));
    //    const ipString = ipv6.toString();
    const ipString = this.state.cellValue;

    return (
      <span>
        <a href="http://10.162.232.22:8000/gwwk.html">{ipString}</a>
      </span>
    );
  }

  static getValueToDisplay(params: { valueFormatted: any; value: any }) {
    return params.valueFormatted ? params.valueFormatted : params.value;
  }
}
