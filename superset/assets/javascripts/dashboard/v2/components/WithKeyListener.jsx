import React from 'react';
import PropTypes from 'prop-types';

const TEST_CACHE = {
  cmdZ: e => (e.metaKey || e.ctrlKey) && e.keyCode === 90,
};

const propTypes = {
  // accepts keyCode
  // or a test func (which is lazily cached using the cacheKey string)
  keyCode: PropTypes.number,
  cacheKey: PropTypes.string,
  test: PropTypes.func, // (event) => Boolean
  onPress: PropTypes.func.isRequired,
};

export default class WithKeyListener extends React.PureComponent {
  componentDidMount() {
    const { keyCode, test, cacheKey, onPress } = this.props;
    let eventListener;
    if (test && cacheKey) { // overwrite cache
      TEST_CACHE[cacheKey] = test;
      eventListener = test;
    } else if (cacheKey && TEST_CACHE[cacheKey]) { // use cache
      eventListener = TEST_CACHE[cacheKey]
    } else if (typeof keyCode === 'number') {
      if (TEST_CACHE[keyCode]) {
        eventListener = TEST_CACHE[cacheKey]; // use keyCode cache
      } else {
        TEST_CACHE[cacheKey] = e => e.keyCode === keyCode; // set cache
        eventListener = TEST_CACHE[cacheKey];
      }
    } else {
      console.warn('Missing cacheKey, test, or keyCode');
      return;
    }

    document.addEventListener('keydown', (e) => {
      if (eventListener(e)) {
        onPress(e);
        alert('keydown');
      }
    });
  }

  componentWillUnmount() {
    document.removeEventListener('keydown');
  }

  render() {
    return null;
  }
}

WithKeyListener.propTypes = propTypes;
