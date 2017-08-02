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
import { exploreReducer } from './reducers/exploreReducer';
import { appSetup } from '../common';
import './main.css';
import '../../stylesheets/reactable-pagination.css';

appSetup();
initJQueryAjax();

const exploreViewContainer = document.getElementById('js-explore-view-container');
const bootstrapData = JSON.parse(exploreViewContainer.getAttribute('data-bootstrap'));
const controls = getControlsState(bootstrapData, bootstrapData.form_data);
delete bootstrapData.form_data;


// Initial state
const bootstrappedState = Object.assign(
  bootstrapData, {
    chartStatus: null,
    chartUpdateEndTime: null,
    chartUpdateStartTime: now(),
    dashboards: [],
    controls,
    latestQueryFormData: getFormDataFromControls(controls),
    filterColumnOpts: [],
    isDatasourceMetaLoading: false,
    isStarred: false,
    queryResponse: null,
    triggerQuery: true,
    triggerRender: false,
    alert: null,
  },
);

const store = createStore(exploreReducer, bootstrappedState,
  compose(applyMiddleware(thunk), initEnhancer(false)),
);

ReactDOM.render(
  <Provider store={store}>
    <div>
      <ExploreViewContainer />
      <AlertsWrapper />
    </div>
  </Provider>,
  exploreViewContainer,
);
