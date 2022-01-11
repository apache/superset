import React, { Component } from 'react';

export default class DomainValueRenderer extends Component<
  {},
  { cellValue: any }
> {
  constructor(props: any) {
    super(props);

    this.state = {
      cellValue: DomainValueRenderer.getValueToDisplay(props),
    };
  }

  // update cellValue when the cell's props are updated
  static getDerivedStateFromProps(nextProps: any) {
    return {
      cellValue: DomainValueRenderer.getValueToDisplay(nextProps),
    };
  }

  render() {
    return (
      <span>
        <a href="http://10.162.232.22:8000/gwwk.html">{this.state.cellValue}</a>
      </span>
    );
  }

  static getValueToDisplay(params: { valueFormatted: any; value: any }) {
    return params.valueFormatted ? params.valueFormatted : params.value;
  }
}
