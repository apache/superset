import React from 'react';
import { hot } from 'react-hot-loader';
import App from './components/App';
import { appSetup } from '../common';

import './main.css';

appSetup();

const profileViewContainer = document.getElementById('app');
const bootstrap = JSON.parse(profileViewContainer.getAttribute('data-bootstrap'));

const Application = () => (
  <App user={bootstrap.user} />
);

export default hot(module)(Application);
