import React from 'react';
import { Panel } from 'react-bootstrap';

const ControlPanel = function ({ name }) {
  return (
    <Panel
      header={<div className="panel-title"><small>{name}</small></div>}
    >
      <select className="form-control input-sm">
        <option>option 1</option>
        <option>option 2</option>
        <option>option 3</option>
      </select>

    </Panel>
  );
};
export default ControlPanel;
