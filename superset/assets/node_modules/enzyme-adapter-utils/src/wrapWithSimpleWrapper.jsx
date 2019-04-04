import React from 'react';
import { intersects } from 'semver';
import PropTypes from 'prop-types';

const propTypes = {
  children: PropTypes.element.isRequired,
};

const Wrapper = (intersects('>= 0.14', React.version)
  // eslint-disable-next-line prefer-arrow-callback
  ? () => Object.assign(function SimpleSFCWrapper({ children }) {
    return children;
  }, { propTypes })
  : () => {
    class SimpleClassWrapper extends React.Component {
      render() {
        const { children } = this.props;
        return children;
      }
    }
    SimpleClassWrapper.propTypes = propTypes;
    return SimpleClassWrapper;
  }
)();

export default function wrap(element) {
  return <Wrapper>{element}</Wrapper>;
}
