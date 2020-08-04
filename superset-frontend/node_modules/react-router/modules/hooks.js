import React from "react";
import invariant from "tiny-invariant";

import Context from "./RouterContext.js";
import matchPath from "./matchPath.js";

const useContext = React.useContext;

export function useHistory() {
  if (__DEV__) {
    invariant(
      typeof useContext === "function",
      "You must use React >= 16.8 in order to use useHistory()"
    );
  }

  return useContext(Context).history;
}

export function useLocation() {
  if (__DEV__) {
    invariant(
      typeof useContext === "function",
      "You must use React >= 16.8 in order to use useLocation()"
    );
  }

  return useContext(Context).location;
}

export function useParams() {
  if (__DEV__) {
    invariant(
      typeof useContext === "function",
      "You must use React >= 16.8 in order to use useParams()"
    );
  }

  const match = useContext(Context).match;
  return match ? match.params : {};
}

export function useRouteMatch(path) {
  if (__DEV__) {
    invariant(
      typeof useContext === "function",
      "You must use React >= 16.8 in order to use useRouteMatch()"
    );
  }

  return path
    ? matchPath(useLocation().pathname, path)
    : useContext(Context).match;
}
