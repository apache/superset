import React, { PropTypes } from 'react';

const propTypes = {
  data: PropTypes.array.isRequired,
  keysToColorsMap: PropTypes.object.isRequired,
};

export default class Legend extends React.Component {
  legendItem(key) {
    return (
      <li style={{ float: 'left' }} key={key}>
        <i
          className="fa fa-circle"
          style={{ color: this.props.keysToColorsMap[key] }}
        /> &nbsp;&nbsp;
        <span>{key}</span>
      </li>
    );
  }

  render() {
    const legendEls = this.props.data.map((d) => this.legendItem(d.key));
    return (
      <ul className="list-unstyled list-inline">
        {legendEls}
      </ul>
    );
  }
}

Legend.propTypes = propTypes;
