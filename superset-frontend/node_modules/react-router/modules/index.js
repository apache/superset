if (__DEV__) {
  if (typeof window !== "undefined") {
    const global = window;
    const key = "__react_router_build__";
    const buildNames = { cjs: "CommonJS", esm: "ES modules", umd: "UMD" };

    if (global[key] && global[key] !== process.env.BUILD_FORMAT) {
      const initialBuildName = buildNames[global[key]];
      const secondaryBuildName = buildNames[process.env.BUILD_FORMAT];

      // TODO: Add link to article that explains in detail how to avoid
      // loading 2 different builds.
      throw new Error(
        `You are loading the ${secondaryBuildName} build of React Router ` +
          `on a page that is already running the ${initialBuildName} ` +
          `build, so things won't work right.`
      );
    }

    global[key] = process.env.BUILD_FORMAT;
  }
}

export { default as MemoryRouter } from "./MemoryRouter";
export { default as Prompt } from "./Prompt";
export { default as Redirect } from "./Redirect";
export { default as Route } from "./Route";
export { default as Router } from "./Router";
export { default as StaticRouter } from "./StaticRouter";
export { default as Switch } from "./Switch";
export { default as generatePath } from "./generatePath";
export { default as matchPath } from "./matchPath";
export { default as withRouter } from "./withRouter";

import { useHistory, useLocation, useParams, useRouteMatch } from "./hooks.js";
export { useHistory, useLocation, useParams, useRouteMatch };

export { default as __RouterContext } from "./RouterContext";
