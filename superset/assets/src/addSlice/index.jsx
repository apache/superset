import React from 'react';
import ReactDOM from 'react-dom';
import { appSetup } from '../common';
import AddSliceContainer from './AddSliceContainer';

appSetup();

const addSliceContainer = document.getElementById('js-add-slice-container');
const bootstrapData = JSON.parse(addSliceContainer.getAttribute('data-bootstrap'));

ReactDOM.render(
  <AddSliceContainer datasources={bootstrapData.datasources} />,
  addSliceContainer,
);
