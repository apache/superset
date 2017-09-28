/* eslint no-unused-vars: 0 */
import React from 'react';
import ReactDOM from 'react-dom';

import App from './components/App';
import { appSetup } from '../common';

import './main.css';

appSetup();

const profileViewContainer = document.getElementById('app');
const bootstrap = JSON.parse(profileViewContainer.getAttribute('data-bootstrap'));

const user = bootstrap.user;
ReactDOM.render(
  <App user={user} />,
  profileViewContainer,
);
