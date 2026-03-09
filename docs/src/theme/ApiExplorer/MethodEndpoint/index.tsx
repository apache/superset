/* ============================================================================
 * Swizzled from docusaurus-theme-openapi-docs to fix SSG crash.
 *
 * The original component calls useTypedSelector (Redux) at the top level,
 * which fails during static site generation because no Redux store is
 * available. This version moves the hook into a browser-only child component
 * so SSG can render the page without a store context.
 * ========================================================================== */

import React from "react";

import BrowserOnly from "@docusaurus/BrowserOnly";
import { useTypedSelector } from "@theme/ApiItem/hooks";

function colorForMethod(method: string) {
  switch (method.toLowerCase()) {
    case "get":
      return "primary";
    case "post":
      return "success";
    case "delete":
      return "danger";
    case "put":
      return "info";
    case "patch":
      return "warning";
    case "head":
      return "secondary";
    case "event":
      return "secondary";
    default:
      return undefined;
  }
}

export interface Props {
  method: string;
  path: string;
  context?: "endpoint" | "callback";
}

interface ServerState {
  server: { value: { url: string; variables?: Record<string, { default?: string }> } | null };
}

// Inner component rendered only in the browser, where the Redux store exists.
function ServerUrl() {
  const serverValue = useTypedSelector((state: ServerState) => state.server.value);

  if (serverValue && serverValue.variables) {
    let serverUrlWithVariables = serverValue.url.replace(/\/$/, "");
    Object.keys(serverValue.variables).forEach((variable) => {
      serverUrlWithVariables = serverUrlWithVariables.replace(
        `{${variable}}`,
        serverValue.variables?.[variable].default ?? ""
      );
    });
    return <>{serverUrlWithVariables}</>;
  }

  if (serverValue && serverValue.url) {
    return <>{serverValue.url}</>;
  }

  return null;
}

function MethodEndpoint({ method, path, context }: Props) {
  const renderServerUrl = () => {
    if (context === "callback") {
      return "";
    }
    return <BrowserOnly>{() => <ServerUrl />}</BrowserOnly>;
  };

  return (
    <>
      <pre className="openapi__method-endpoint">
        <span className={"badge badge--" + colorForMethod(method)}>
          {method === "event" ? "Webhook" : method.toUpperCase()}
        </span>{" "}
        {method !== "event" && (
          <h2 className="openapi__method-endpoint-path">
            {renderServerUrl()}
            {`${path.replace(/{([a-z0-9-_]+)}/gi, ":$1")}`}
          </h2>
        )}
      </pre>
      <div className="openapi__divider" />
    </>
  );
}

export default MethodEndpoint;
