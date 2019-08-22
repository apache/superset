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
import React from 'react';
import PropTypes from 'prop-types';
import { forEach, map } from 'lodash';
import './Funnel.css';
import { SuperChart } from "@superset-ui/chart";
import _ from 'lodash';

const propTypes = {
  xAxisLabel: PropTypes.string,
  yAxisLabel: PropTypes.string,
  width: PropTypes.number,
  height: PropTypes.number
};
const defaultProps = {
  xAxisLabel: '',
  yAxisLabel: '',
};

class Funnel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasChanged: false,
    };
  }

  render() {
    const { data, funnelSteps, yAxisLabel, xAxisLabel, verboseMap, width, height } = this.props;
    const selectedValues = funnelSteps && funnelSteps.selectedValues;

    const values = [];
    let nn = 0;
    let prevValue = 0;
    const selValues = map(selectedValues, item => item);
    let upperYBound = 0; 

    forEach(data, function (item) {
      forEach(item, (value, name) => {
        const label = selValues && selValues[nn] && selValues[nn].step_label || `Step ${nn + 1}`
        let metric = selValues && selValues[nn] && selValues[nn].metric
        if (typeof metric == 'object' && metric !== null){
          metric = metric.label
        }

        //set upperYBound while iterating through value
        const upperY = Number(value.valueOf())
        if (upperY > upperYBound){ upperYBound = upperY }

         let delta =  prevValue > 0 ? Math.round(100 * value / prevValue, 1) - 100 : (value > 0 ? 100 : 0);
        let deltaStr = `${delta}%`;
        values.push({key: `${metric}${nn > 0 ? ', ' + deltaStr : ''}`, values: [{ y: value, x: label ? label : `Step ${nn+1}`} ]});
        nn++;
        prevValue = value;
      })
    });

  
    return (
      <div className="scrollbar-container">
        <div className="scrollbar-content">
          <SuperChart
            chartProps={{
              datasource: {
                verboseMap,
              },
              formData: {
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
                xAxisLabel,
                xTicksLayout: 'auto',
                yAxisFormat: ',d',
              },
              height,
              width,
              upperYBound,
              payload: {
                data: values,
              }
            }}
            chartType="dist_bar"
            className=""
            id=""
            onRenderFailure={function(){}}
            onRenderSuccess={function(){}}
            overrideTransformProps={undefined}
            postTransformProps={function(a){return a}}
            preTransformProps={function(a){return a}}
          />
        </div>
      </div>
    );
  }
}

Funnel.propTypes = propTypes;
Funnel.defaultProps = defaultProps;

export default Funnel;
