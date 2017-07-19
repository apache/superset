/* eslint camelcase: 0 */
import React from 'react';
import ReactDOM from 'react-dom';

// Reudx libs
import { createStore, applyMiddleware, compose, combineReducers } from 'redux';
import { Provider } from 'react-redux';
import { compressToBase64, decompressFromBase64 } from 'lz-string';
import persistState from 'redux-localstorage';
import thunk from 'redux-thunk';

import { appSetup } from '../common';
import { initJQueryAjax } from '../modules/utils';
import { initEnhancer } from '../reduxUtils';

import configureShortcuts from './shortcuts';

import FormDataStore from './stores/FormDataStore';
import { refDataReducer } from './reducers/refDataReducer';
import { settingsReducer } from './reducers/settingsReducer';
import { vizDataReducer } from './reducers/vizDataReducer';
import { controlReducer } from './reducers/controlReducer';
import { keyBindingsReducer } from './reducers/keyBindingsReducer';

import { bootstrap } from './actions/querySettingsActions';
import { LOCAL_STORAGE_KEY_PREFIX } from './constants';
import { getSessionKey, updateSession } from './SessionManager';

import ReduxContainer from './components/Container';
import './main.css';

const exploreViewContainer = document.getElementById('js-swivel-view-container');
const bootstrapData = JSON.parse(exploreViewContainer.getAttribute('data-bootstrap'));

let formData;
if (bootstrapData.lz_form_data) {
  formData = JSON.parse(decompressFromBase64(bootstrapData.lz_form_data));
} else if (bootstrapData.form_data) {
  formData = JSON.parse(bootstrapData.form_data);
} else {
  formData = {};
}
const bsFromData = new FormDataStore(formData);
const session = getSessionKey(bootstrapData);
const localStorageKey = `${LOCAL_STORAGE_KEY_PREFIX}${session}`;

// If there is any JS error ask if local storage should be deleted
// This will somewhat gracefully handle changes in the data model
onerror = (message, file, line, column, errorObject) => {
  // eslint-disable-next-line no-console
  console.error({ message, file, line, column, errorObject });
  if (localStorage.getItem(localStorageKey)) {
    // eslint-disable-next-line no-alert
    const r = confirm(`Error: ${message} \n\n Reset Swivel?`);
    if (r) {
      location.search = '?reset=true';
      location.load();
      return true;
    }
    return false;
  }
  return false;
};


appSetup();
initJQueryAjax();

const combinedReducer = combineReducers({
  controls: controlReducer,
  settings: settingsReducer,
  refData: refDataReducer,
  vizData: vizDataReducer,
  keyBindings: keyBindingsReducer,
});

// This will serialize redux-undo states correctly as well as limit the
// the scope of the state that will get persisted in localStorage
function storageSlicer() {
  return (state) => {
    if (state.settings) {
      return {
        controls: state.controls,
        settings: {
          future: state.settings.future,
          present: state.settings.present,
          past: state.settings.past,
        },
      };
    }
    return {};
  };
}

function storageDeserialize(...args) {
  const newArgs = args;
  if (newArgs.length && newArgs[0]) {
    newArgs[0] = decompressFromBase64(newArgs[0]);
    const state = JSON.parse(...newArgs);
    if (state && 'settings' in state) {
      state.settings.history = state.settings;
      return state;
    }
  }
  return null;
}

function storageSerialize(...args) {
  if (args.length) {
    updateSession(session, args[0].settings.present.viz.title);
  }
  return compressToBase64(JSON.stringify(...args));
}

const store = createStore(combinedReducer,
    compose(applyMiddleware(thunk),
        initEnhancer(false),
        persistState(null, {
          key: localStorageKey,
          slicer: storageSlicer,
          serialize: storageSerialize,
          deserialize: storageDeserialize,
        })),
);

const swivelViewContainer = document.getElementById('js-swivel-view-container');

// Build initial state from bootstrap data
store.dispatch(bootstrap(bsFromData));

// Hook up global Keyboard shortcuts
configureShortcuts(store);

ReactDOM.render(
  <Provider store={store}>
    <ReduxContainer />
  </Provider>
   , swivelViewContainer,
);
