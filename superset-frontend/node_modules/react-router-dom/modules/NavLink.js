import React from "react";
import { __RouterContext as RouterContext, matchPath } from "react-router";
import PropTypes from "prop-types";
import invariant from "tiny-invariant";
import Link from "./Link";
import { resolveToLocation, normalizeToLocation } from "./utils/locationUtils";

// React 15 compat
const forwardRefShim = C => C;
let { forwardRef } = React;
if (typeof forwardRef === "undefined") {
  forwardRef = forwardRefShim;
}

function joinClassnames(...classnames) {
  return classnames.filter(i => i).join(" ");
}

/**
 * A <Link> wrapper that knows if it's "active" or not.
 */
const NavLink = forwardRef(
  (
    {
      "aria-current": ariaCurrent = "page",
      activeClassName = "active",
      activeStyle,
      className: classNameProp,
      exact,
      isActive: isActiveProp,
      location: locationProp,
      strict,
      style: styleProp,
      to,
      innerRef, // TODO: deprecate
      ...rest
    },
    forwardedRef
  ) => {
    return (
      <RouterContext.Consumer>
        {context => {
          invariant(context, "You should not use <NavLink> outside a <Router>");

          const currentLocation = locationProp || context.location;
          const toLocation = normalizeToLocation(
            resolveToLocation(to, currentLocation),
            currentLocation
          );
          const { pathname: path } = toLocation;
          // Regex taken from: https://github.com/pillarjs/path-to-regexp/blob/master/index.js#L202
          const escapedPath =
            path && path.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");

          const match = escapedPath
            ? matchPath(currentLocation.pathname, {
                path: escapedPath,
                exact,
                strict
              })
            : null;
          const isActive = !!(isActiveProp
            ? isActiveProp(match, currentLocation)
            : match);

          const className = isActive
            ? joinClassnames(classNameProp, activeClassName)
            : classNameProp;
          const style = isActive ? { ...styleProp, ...activeStyle } : styleProp;

          const props = {
            "aria-current": (isActive && ariaCurrent) || null,
            className,
            style,
            to: toLocation,
            ...rest
          };

          // React 15 compat
          if (forwardRefShim !== forwardRef) {
            props.ref = forwardedRef || innerRef;
          } else {
            props.innerRef = innerRef;
          }

          return <Link {...props} />;
        }}
      </RouterContext.Consumer>
    );
  }
);

if (__DEV__) {
  NavLink.displayName = "NavLink";

  const ariaCurrentType = PropTypes.oneOf([
    "page",
    "step",
    "location",
    "date",
    "time",
    "true"
  ]);

  NavLink.propTypes = {
    ...Link.propTypes,
    "aria-current": ariaCurrentType,
    activeClassName: PropTypes.string,
    activeStyle: PropTypes.object,
    className: PropTypes.string,
    exact: PropTypes.bool,
    isActive: PropTypes.func,
    location: PropTypes.object,
    strict: PropTypes.bool,
    style: PropTypes.object
  };
}

export default NavLink;
