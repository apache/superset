/* eslint no-unused-vars: 0 */
import React from 'react';
import ReactDOM from 'react-dom';
import { Panel, Row, Col, FormControl } from 'react-bootstrap';

import { appSetup } from '../common';
import App from './App';

appSetup();

const container = document.getElementById('app');
const bootstrap = JSON.parse(container.getAttribute('data-bootstrap'));

ReactDOM.render(
  <App />,
  container,
);
