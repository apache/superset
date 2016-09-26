import React from 'react';
import { Panel } from 'react-bootstrap';
import ControlPanel from './ControlPanel';

const ControlPanelsContainer = function () {
  return (
    <Panel>
      <ControlPanel name="panel 1" />
      <ControlPanel name="panel 2" />
      <ControlPanel name="panel 3" />
      <ControlPanel name="panel 4" />
      <ControlPanel name="panel 5" />
      <ControlPanel name="panel 6" />
      <ControlPanel name="panel 7" />
      <ControlPanel name="panel 8" />
      <ControlPanel name="panel 9" />
      <ControlPanel name="panel 10" />
    </Panel>
  );
};
export default ControlPanelsContainer;
