import React from 'react';
import { render } from 'react-dom';
import { Jumbotron } from 'react-bootstrap';

function App() {
  return (
    <Jumbotron>
      <h1>Caravel</h1>
      <p>Extensible visualization tool for exploring data from any database.</p>
    </Jumbotron>
  );
}

render(<App />, document.getElementById('app'));
