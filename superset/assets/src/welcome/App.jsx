/* eslint no-unused-vars: 0 */
import React from 'react';
import { hot } from 'react-hot-loader';
import { appSetup } from '../common';
import Welcome from './Welcome';

appSetup();

const container = document.getElementById('app');
const bootstrap = JSON.parse(container.getAttribute('data-bootstrap'));
const user = { ...bootstrap.user };

const App = () => (
  <Welcome user={user} />
);

export default hot(module)(App);
