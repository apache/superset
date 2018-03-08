import React from 'react';
import PropTypes from 'prop-types';

import './Legend.css';

const propTypes = {
  categories: PropTypes.object,
  toggleCategory: PropTypes.func,
};

const defaultProps = {
  categories: { bar: '#f00' },
  toggleCategory: (e) => { console.log(e); },
};

export default class Legend extends React.PureComponent {
  render() {
    const categories = Object.entries(this.props.categories).map(([k, v]) => {
      const style = {
        color: 'rgba(' + v.join(', ') + ')',
      };
      return <li><span onClick={() => this.props.toggleCategory(k)}><span style={style}>&#x25CF;</span> {k}</span></li>;
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
