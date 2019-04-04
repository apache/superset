import React from 'react';
import PropTypes from 'prop-types';
import hoistNonReactStatics from 'hoist-non-react-statics';
import deepmerge from 'deepmerge';

import ThemeProvider from './ThemeProvider';
import ThemedStyleSheet from './ThemedStyleSheet';

// Add some named exports for convenience.
export { ThemeProvider };
export const css = ThemedStyleSheet.resolve;

const contextTypes = {
  themeName: PropTypes.string,
};

const EMPTY_STYLES = {};

function baseClass(pureComponent) {
  if (pureComponent) {
    if (!React.PureComponent) {
      throw new ReferenceError('withStyles() pureComponent option requires React 15.3.0 or later');
    }

    return React.PureComponent;
  }

  return React.Component;
}

export function withStyles(
  styleFn,
  {
    stylesPropName = 'styles',
    themePropName = 'theme',
    flushBefore = false,
    pureComponent = false,
  } = {},
) {
  const styleDef = styleFn && ThemedStyleSheet.create(styleFn);
  const BaseClass = baseClass(pureComponent);

  return function withStylesHOC(WrappedComponent) {
    // NOTE: Use a class here so components are ref-able if need be:
    // eslint-disable-next-line react/prefer-stateless-function
    class WithStyles extends BaseClass {
      render() {
        const { themeName } = this.context;

        // As some components will depend on previous styles in
        // the component tree, we provide the option of flushing the
        // buffered styles (i.e. to a style tag) **before** the rendering
        // cycle begins.
        //
        // The interfaces provide the optional "flush" method which
        // is run in turn by ThemedStyleSheet.flush.
        if (flushBefore) {
          ThemedStyleSheet.flush();
        }

        return (
          <WrappedComponent
            {...this.props}
            {...{
              [themePropName]: ThemedStyleSheet.get(themeName),
              [stylesPropName]: styleDef ? styleDef(themeName) : EMPTY_STYLES,
            }}
          />
        );
      }
    }

    const wrappedComponentName = WrappedComponent.displayName
      || WrappedComponent.name
      || 'Component';

    WithStyles.WrappedComponent = WrappedComponent;
    WithStyles.contextTypes = contextTypes;
    WithStyles.displayName = `withStyles(${wrappedComponentName})`;
    if (WrappedComponent.propTypes) {
      WithStyles.propTypes = deepmerge({}, WrappedComponent.propTypes);
      delete WithStyles.propTypes[stylesPropName];
      delete WithStyles.propTypes[themePropName];
    }
    if (WrappedComponent.defaultProps) {
      WithStyles.defaultProps = deepmerge({}, WrappedComponent.defaultProps);
    }

    return hoistNonReactStatics(WithStyles, WrappedComponent);
  };
}
