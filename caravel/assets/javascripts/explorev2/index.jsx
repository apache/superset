import React from 'react';
import ReactDOM from 'react-dom';
import ExploreViewContainer from './components/ExploreViewContainer';

const exploreViewContainer = document.getElementById('js-explore-view-container');
const bootstrapData = exploreViewContainer.getAttribute('data-bootstrap');
console.log('bootstrapData', bootstrapData)
ReactDOM.render(
  <ExploreViewContainer
    data={bootstrapData}
  />,
  exploreViewContainer
);
