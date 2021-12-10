import React from "react";
import {Route} from "react-router-dom";
import {ThemeProvider} from "@superset-ui/core";
import {bootstrapData, theme} from "../preamble";
import {Provider as ReduxProvider} from "react-redux";
import {store} from "./store";
import {DndProvider} from "react-dnd";
import {HTML5Backend} from "react-dnd-html5-backend";
import FlashProvider from "../components/FlashProvider";
import {EmbeddedUiConfigProvider} from "../components/UiConfigContext";
import {DynamicPluginProvider} from "../components/DynamicPlugins";
import {QueryParamProvider} from "use-query-params";

const common = { ...bootstrapData.common };

export const RootContextProviders: React.FC = ({ children }) => {
  return (
    <ThemeProvider theme={theme}>
      <ReduxProvider store={store}>
        <DndProvider backend={HTML5Backend}>
          <FlashProvider messages={common.flash_messages}>
            <EmbeddedUiConfigProvider>
              <DynamicPluginProvider>
                <QueryParamProvider
                  ReactRouterRoute={Route}
                  stringifyOptions={{ encode: false }}
                >
                  {children}
                </QueryParamProvider>
              </DynamicPluginProvider>
            </EmbeddedUiConfigProvider>
          </FlashProvider>
        </DndProvider>
      </ReduxProvider>
    </ThemeProvider>
  );
};
