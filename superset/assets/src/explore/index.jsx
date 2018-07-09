/* eslint no-undef: 2 */
import React from 'react';
import ReactDOM from 'react-dom';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';

import shortid from 'shortid';
import { now } from '../modules/dates';
import { initEnhancer } from '../reduxUtils';
import { getChartKey } from './exploreUtils';
import ToastPresenter from '../messageToasts/containers/ToastPresenter';
import { getControlsState, getFormDataFromControls } from './store';
import { initJQueryAjax } from '../modules/utils';
import ExploreViewContainer from './components/ExploreViewContainer';
import rootReducer from './reducers/index';
import getToastsFromPyFlashMessages from '../messageToasts/utils/getToastsFromPyFlashMessages';

import { appSetup } from '../common';
import './main.css';
import '../../stylesheets/reactable-pagination.css';

appSetup();
initJQueryAjax();

const exploreViewContainer = document.getElementById('app');
const bootstrapData = JSON.parse(exploreViewContainer.getAttribute('data-bootstrap'));
const controls = getControlsState(bootstrapData, bootstrapData.form_data);
const rawFormData = { ...bootstrapData.form_data };

delete bootstrapData.form_data;
delete bootstrapData.common.locale;
delete bootstrapData.common.language_pack;

// Initial state
const bootstrappedState = {
  ...bootstrapData,
  rawFormData,
  controls,
  filterColumnOpts: [],
  isDatasourceMetaLoading: false,
  isStarred: false,
};
const slice = bootstrappedState.slice;
const sliceFormData = slice
  ? getFormDataFromControls(getControlsState(bootstrapData, slice.form_data))
  : null;
const chartKey = getChartKey(bootstrappedState);
const initState = {
  charts: {
    [chartKey]: {
      id: chartKey,
      chartAlert: null,
      chartStatus: 'loading',
      chartUpdateEndTime: null,
      chartUpdateStartTime: now(),
      latestQueryFormData: getFormDataFromControls(controls),
      sliceFormData,
      queryRequest: null,
      queryResponse: null,
      triggerQuery: true,
      lastRendered: 0,
    },
  },
  saveModal: {
    dashboards: [],
    saveModalAlert: null,
  },
  explore: bootstrappedState,
  impressionId: shortid.generate(),
  messageToasts: getToastsFromPyFlashMessages((bootstrapData.common || {}).flash_messages || []),
};

const store = createStore(
  rootReducer,
  initState,
  compose(
    applyMiddleware(thunk),
    initEnhancer(false),
  ),
);

ReactDOM.render(
  <Provider store={store}>
    <div>
      <ExploreViewContainer />
      <ToastPresenter />
    </div>
  </Provider>,
  exploreViewContainer,
);
