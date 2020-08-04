import React from 'react';
import PropTypes from 'prop-types';

export default class RootFinder extends React.Component {
  render() {
    const { children } = this.props;
    return children;
  }
}
RootFinder.propTypes = {
  children: PropTypes.node,
};
RootFinder.defaultProps = {
  children: null,
};
