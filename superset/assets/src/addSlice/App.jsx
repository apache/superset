import React from 'react';
import { hot } from 'react-hot-loader';
import { appSetup } from '../common';
import AddSliceContainer from './AddSliceContainer';

appSetup();

const addSliceContainer = document.getElementById('js-add-slice-container');
const bootstrapData = JSON.parse(addSliceContainer.getAttribute('data-bootstrap'));

const App = () => (
  <AddSliceContainer datasources={bootstrapData.datasources} />
);

export default hot(module)(App);
