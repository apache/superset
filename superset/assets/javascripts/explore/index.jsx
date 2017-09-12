/* eslint camelcase: 0 */
import React from 'react';
import ReactDOM from 'react-dom';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';

import { now } from '../modules/dates';
import { initEnhancer } from '../reduxUtils';
import AlertsWrapper from '../components/AlertsWrapper';
import { getControlsState, getFormDataFromControls } from './stores/store';
import { initJQueryAjax } from '../modules/utils';
import ExploreViewContainer from './components/ExploreViewContainer';
import rootReducer from './reducers/index';

import { appSetup } from '../common';
import './main.css';
import '../../stylesheets/reactable-pagination.css';

appSetup();
initJQueryAjax();

const exploreViewContainer = document.getElementById('app');
const bootstrapData = JSON.parse(exploreViewContainer.getAttribute('data-bootstrap'));
const controls = getControlsState(bootstrapData, bootstrapData.form_data);
delete bootstrapData.form_data;
delete bootstrapData.common.locale;
delete bootstrapData.common.language_pack;

// Initial state
const bootstrappedState = Object.assign(
  bootstrapData, {
    controls,
    filterColumnOpts: [],
    isDatasourceMetaLoading: false,
    isStarred: false,
    triggerQuery: true,
    triggerRender: false,
  },
);

const initState = {
  chart: {
    chartAlert: null,
    chartStatus: null,
    chartUpdateEndTime: null,
    chartUpdateStartTime: now(),
    latestQueryFormData: getFormDataFromControls(controls),
    queryResponse: null,
  },
  saveModal: {
    dashboards: [],
    saveModalAlert: null,
  },
  explore: bootstrappedState,
};
const store = createStore(rootReducer, initState,
  compose(applyMiddleware(thunk), initEnhancer(false)),
);

ReactDOM.render(
  <Provider store={store}>
    <div>
      <ExploreViewContainer />
      <AlertsWrapper initMessages={bootstrappedState.common.flash_messages} />
    </div>
  </Provider>,
  exploreViewContainer,
);
