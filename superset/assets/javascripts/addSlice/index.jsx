import React from 'react';
import ReactDOM from 'react-dom';
import AddSliceContainer from './AddSliceContainer';

const addSliceContainer = document.getElementById('js-add-slice-container');
const bootstrapData = JSON.parse(addSliceContainer.getAttribute('data-bootstrap'));

ReactDOM.render(
  <AddSliceContainer bootstrapData={bootstrapData} />,
  addSliceContainer,
);
