/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint camelcase: 0 */

import React from 'react';
import PropTypes from 'prop-types';
import { map } from 'lodash';

import './Funnel.css';
import ChartRenderer from '../../chart/ChartRenderer';

const propTypes = {
  rawFormData: PropTypes.object,
  width: PropTypes.number,
  height: PropTypes.number,
  queryData: PropTypes.array.isRequired,
  funnelSteps: PropTypes.array.isRequired,
  datasource: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
};

const defaultFormData = {
  barstacked: false,
  bottomMargin: 'auto',
  colorScheme: 'd3Category10',
  contribution: false,
  orderBars: false,
  reduceXTicks: false,
  showBarValue: false,
  showControls: false,
  showLegend: true,
  vizType: 'dist_bar',
  xTicksLayout: 'auto',
  yAxisFormat: ',d',
};

class Funnel extends React.Component {
  constructor(props) {
    super(props);
    this.formatQueryResponse = this.formatQueryResponse.bind(this);
    this.formatValues = this.formatValues.bind(this);
  }

   formatQueryResponse(funnelSteps) {
    const selectedValues = funnelSteps && funnelSteps.selectedValues;
    const selValues = map(selectedValues, item => item);
    const values = [];
    let prevValue = 0;
    Object.values(this.props.queryData.data).forEach((value, index) => {
        const label = selValues && selValues[index] && selValues[index].step_label;

        // Return Delta between each step Visualization
        const roundedValue = value > 0 ? 100 : 0;
        const delta =  prevValue > 0 ?
            Math.round(100 * value / prevValue, 1) - 100
            : roundedValue;
        const deltaStr = `${delta}%`;
        const tag_label = label || `Step ${index + 1}`;
        const valueObj = this.formatValues({ tag_label, index, value, deltaStr });
        values.push(valueObj);
        prevValue = value;
    });
    return values;
   }

  formatValues(formatObj, formatOptions = this.props.rawFormData) {
    const { tag_label, index, value, deltaStr } = formatObj;
    const { funnel_mode, x_axis_label, show_delta } = formatOptions;

    const chart_label = funnel_mode ?
      x_axis_label || 'Funnel/Step Visualizaiton'
      : tag_label;

    const tagLabel = index > 0 && show_delta ?
      `${tag_label}, ${deltaStr}`
      : tag_label;

    const valueOutput = { key: tagLabel, values: [{ y: value, x: chart_label }] };

    if (funnel_mode) {
      valueOutput.values.push({ y: -value, x: chart_label });
    }
    return valueOutput;
  }
  render() {
    const { funnelSteps,
            width,
            height,
            datasource,
            actions,
            queryData } = this.props;

    const formatedData = this.formatQueryResponse(funnelSteps);

    return (
      <div className="scrollbar-container">
        <div className="scrollbar-content">
          <ChartRenderer
            chartId={'11'}
            chartType="dist_bar"
            vizType="dist_bar"
            formData={{ ...defaultFormData }}
            queryResponse={Object.assign({}, queryData, { data: formatedData })}
            datasource={datasource}
            chartStatus="rendered"
            triggerRender
            height={height}
            width={width}
            actions={actions}
          />
        </div>
      </div>
    );
  }
}

Funnel.propTypes = propTypes;

export default Funnel;
