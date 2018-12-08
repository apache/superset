import React from 'react';
import PropTypes from 'prop-types';

import './Legend.css';

const propTypes = {
  categories: PropTypes.object,
  toggleCategory: PropTypes.func,
  showSingleCategory: PropTypes.func,
  position: PropTypes.oneOf([null, 'tl', 'tr', 'bl', 'br']),
};

const defaultProps = {
  categories: {},
  toggleCategory: () => {},
  showSingleCategory: () => {},
  position: 'tr',
};

export default class Legend extends React.PureComponent {
  render() {
    if (Object.keys(this.props.categories).length === 0 || this.props.position === null) {
      return null;
    }

    const categories = Object.entries(this.props.categories).map(([k, v]) => {
      const style = { color: 'rgba(' + v.color.join(', ') + ')' };
      const icon = v.enabled ? '\u25CF' : '\u25CB';
      return (
        <li key={k}>
          <a
            href="#"
            onClick={() => this.props.toggleCategory(k)}
            onDoubleClick={() => this.props.showSingleCategory(k)}
          >
            <span style={style}>{icon}</span> {k}
          </a>
        </li>
      );
    });

    const vertical = this.props.position.charAt(0) === 't' ? 'top' : 'bottom';
    const horizontal = this.props.position.charAt(1) === 'r' ? 'right' : 'left';
    const style = {
      position: 'absolute',
      [vertical]: '0px',
      [horizontal]: '10px',
    };

    return (
      <div className={'legend'} style={style}>
        <ul className={'categories'}>{categories}</ul>
      </div>
    );
  }
}

Legend.propTypes = propTypes;
Legend.defaultProps = defaultProps;
