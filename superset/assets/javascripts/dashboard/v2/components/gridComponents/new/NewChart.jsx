import React from 'react';
// import PropTypes from 'prop-types';

import { CHART_TYPE } from '../../../util/componentTypes';
import { NEW_CHART_ID } from '../../../util/constants';
import DraggableNewComponent from './DraggableNewComponent';

const propTypes = {
};

export default class DraggableNewChart extends React.PureComponent {
  render() {
    return (
      <DraggableNewComponent
        id={NEW_CHART_ID}
        type={CHART_TYPE}
        label="Chart"
        className="fa fa-area-chart"
      />
    );
  }
}

DraggableNewChart.propTypes = propTypes;
