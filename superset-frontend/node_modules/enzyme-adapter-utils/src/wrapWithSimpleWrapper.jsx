import React from 'react';
import { intersects } from 'semver';
import { or, explicitNull } from 'airbnb-prop-types';
import PropTypes from 'prop-types';

const propTypes = {
  children: or([explicitNull().isRequired, PropTypes.node.isRequired]),
};

const defaultProps = {
  children: undefined,
};

const Wrapper = (intersects('>= 0.14', React.version)
  // eslint-disable-next-line prefer-arrow-callback
  ? () => Object.assign(function SimpleSFCWrapper({ children }) {
    return children;
  }, { propTypes, defaultProps })
  : () => {
    class SimpleClassWrapper extends React.Component {
      render() {
        const { children } = this.props;
        return children;
      }
    }
    SimpleClassWrapper.propTypes = propTypes;
    SimpleClassWrapper.defaultProps = defaultProps;
    return SimpleClassWrapper;
  }
)();

export default function wrap(element) {
  return <Wrapper>{element}</Wrapper>;
}
