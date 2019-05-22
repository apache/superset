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
import { forEach } from 'lodash';
import './Funnel.css';
import {SuperChart} from "@superset-ui/chart";

const propTypes = {
  xAxisLabel: PropTypes.string,
  yAxisLabel: PropTypes.string,
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
    const { data, funnelSteps, yAxisLabel, xAxisLabel, verboseMap } = this.props;
    const selectedValues = funnelSteps && funnelSteps.selectedValues;

    const values = [];
    let nn = 0
    let prevValue = 0

    forEach(data, function (item) {
      forEach(item, (value, name) => {
        let label = selectedValues && selectedValues[nn] && selectedValues[nn].step_label;
        let delta =  prevValue > 0 ? Math.round(100 * value / prevValue, 1) - 100 : (value > 0 ? 100 : 0);
        let deltaStr = `${delta}%`;
        values.push({key: `${name}${nn > 0 ? ', ' + deltaStr : ''}`, values: [{ y: value, x: label ? label : `Step ${nn+1}`} ]});
        nn++;
        prevValue = value
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
                xAxisLabel: xAxisLabel,
                xTicksLayout: 'auto',
                yAxisFormat: ',d',
                yAxisLabel: yAxisLabel
              },
              height: 400,
              payload: {
                data: values,
              },
              width: 400
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
