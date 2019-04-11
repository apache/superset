import React from 'react';
import { hot } from 'react-hot-loader';
import setupApp from '../setup/setupApp';
import setupPlugins from '../setup/setupPlugins';
import AddAlertContainer from './AddAlertContainer';

setupApp();
setupPlugins();


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
