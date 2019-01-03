import React from 'react';
import { hot } from 'react-hot-loader';
import { appSetup } from '../common';
import AddAlertContainer from './AddAlertContainer';

appSetup();

const addAlertContainer = document.getElementById('js-add-alert-container');
const bootstrapData = JSON.parse(addAlertContainer.getAttribute('data-bootstrap'));

const App = () => (
  <AddAlertContainer
      datasources={bootstrapData.datasources}
      alertData={bootstrapData.alert_data}
      deployments={bootstrapData.deployments}
  />
);

export default hot(module)(App);
