import React from 'react';
import ReactDOM from 'react-dom';
import singleSpaReact from 'single-spa-react';
import { GlobalError } from 'src/Superstructure/components/GlobalError';
import { RootComponent } from 'src/Superstructure/Root';

export const { bootstrap, mount, unmount } = singleSpaReact({
  React,
  ReactDOM,
  rootComponent: RootComponent,
  errorBoundary: err => (
    <GlobalError
      title="Error happened =("
      body={err.message}
      stackTrace={err.stack}
    />
  ),
});
