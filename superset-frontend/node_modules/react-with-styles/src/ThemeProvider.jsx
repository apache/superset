import React from 'react';
import PropTypes from 'prop-types';

const propTypes = {
  children: PropTypes.node.isRequired,
  name: PropTypes.string.isRequired,
};

const childContextTypes = {
  themeName: PropTypes.string,
};

export default class ThemeProvider extends React.Component {
  getChildContext() {
    return {
      themeName: this.props.name,
    };
  }

  render() {
    return React.Children.only(this.props.children);
  }
}

ThemeProvider.propTypes = propTypes;
ThemeProvider.childContextTypes = childContextTypes;
