import React from 'react';
import PropTypes from 'prop-types';

import './Legend.css';

const propTypes = {
  categories: PropTypes.object,
  toggleCategory: PropTypes.func,
};

const defaultProps = {
  categories: {},
  toggleCategory: () => {},
};

export default class Legend extends React.PureComponent {
  render() {
    if (Object.keys(this.props.categories).length === 0) {
      return null;
    }

    const categories = Object.entries(this.props.categories).map(([k, v]) => {
      const style = { color: 'rgba(' + v.color.join(', ') + ')' };
      const icon = v.enabled ? '\u25CF' : '\u25CB';
      return (
        <li>
          <a onClick={() => this.props.toggleCategory(k)}>
            <span style={style}>{icon}</span> {k}
          </a>
        </li>
      );
    });
    return (
      <div className={'legend'}>
        <ul className={'categories'}>{categories}</ul>
      </div>
    );
  }
}

Legend.propTypes = propTypes;
Legend.defaultProps = defaultProps;
