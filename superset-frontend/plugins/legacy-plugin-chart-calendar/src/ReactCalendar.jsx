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
import PropTypes from 'prop-types';
import { reactify, styled, css, useTheme } from '@superset-ui/core';
import { Global } from '@emotion/react';
import Component from './Calendar';

const ReactComponent = reactify(Component);

const Calendar = ({ className, ...otherProps }) => {
  const theme = useTheme();
  return (
    <div className={className}>
      <Global
        styles={css`
          .d3-tip {
            line-height: 1;
            padding: ${theme.gridUnit * 3}px;
            background: ${theme.colors.grayscale.dark2};
            color: ${theme.colors.grayscale.light5};
            border-radius: 4px;
            pointer-events: none;
            z-index: 1000;
            font-size: ${theme.typography.sizes.s}px;
          }
          /* Creates a small triangle extender for the tooltip */
          .d3-tip:after {
            box-sizing: border-box;
            display: inline;
            font-size: ${theme.typography.sizes.xs};
            width: 100%;
            line-height: 1;
            color: ${theme.colors.grayscale.dark2};
            position: absolute;
            pointer-events: none;
          }
          /* Northward tooltips */
          .d3-tip.n:after {
            content: '\\25BC';
            margin: -${theme.gridUnit}px 0 0 0;
            top: 100%;
            left: 0;
            text-align: center;
          }
          /* Eastward tooltips */
          .d3-tip.e:after {
            content: '\\25C0';
            margin: -${theme.gridUnit}px 0 0 0;
            top: 50%;
            left: -${theme.gridUnit * 2}px;
          }
          /* Southward tooltips */
          .d3-tip.s:after {
            content: '\\25B2';
            margin: 0;
            top: -${theme.gridUnit * 2}px;
            left: 0;
            text-align: center;
          }
          /* Westward tooltips */
          .d3-tip.w:after {
            content: '\\25B6';
            margin: -${theme.gridUnit}px 0 0 0px;
            top: 50%;
            left: 100%;
          }
        `}
      />
      <ReactComponent {...otherProps} theme={theme} />
    </div>
  );
};

Calendar.defaultProps = {
  otherProps: {},
};

Calendar.propTypes = {
  className: PropTypes.string.isRequired,
  otherProps: PropTypes.objectOf(PropTypes.any),
};

export default styled(Calendar)`
  ${({ theme }) => `
    .superset-legacy-chart-calendar {
      padding: ${theme.gridUnit * 3}px;
      position: static !important;
      overflow: auto !important;
    }

    .superset-legacy-chart-calendar .ch-tooltip {
      margin-left: ${theme.gridUnit * 5}px;
      margin-top: ${theme.gridUnit}px;
    }

    .superset-legacy-chart-calendar .d3-tip {
      line-height: 1;
      padding: ${theme.gridUnit * 3}px;
      background: ${theme.colors.grayscale.dark2};
      color: ${theme.colors.grayscale.light5};
      border-radius: ${theme.borderRadius}px;
      pointer-events: none;
      z-index: 1000;
    }

    .cal-heatmap-container {
      display: block;
    }

    .cal-heatmap-container .graph-label {
      fill: ${theme.colors.grayscale.base};
      font-size: ${theme.typography.sizes.xs}px;
    }

    .cal-heatmap-container .graph,
    .cal-heatmap-container .graph-legend rect {
      shape-rendering: crispedges;
    }

    .cal-heatmap-container .graph-rect {
      fill: ${theme.colors.grayscale.light2};
    }

    .cal-heatmap-container .graph-subdomain-group rect:hover {
      stroke: ${theme.colors.grayscale.dark2};
      stroke-width: 1px;
    }

    .cal-heatmap-container .subdomain-text {
      font-size: ${theme.typography.sizes.xs}px;
      pointer-events: none;
    }

    .cal-heatmap-container .hover_cursor:hover {
      cursor: pointer;
    }

    .cal-heatmap-container .qi {
      background-color: ${theme.colors.grayscale.base};
      fill: ${theme.colors.grayscale.base};
    }

    .cal-heatmap-container .q1 {
      background-color: ${theme.colors.alert.light2};
      fill: ${theme.colors.alert.light2};
    }

    .cal-heatmap-container .q2 {
      background-color: ${theme.colors.alert.light1};
      fill: ${theme.colors.alert.light1};
    }

    .cal-heatmap-container .q3 {
      background-color: ${theme.colors.success.light1};
      fill: ${theme.colors.success.light1};
    }

    .cal-heatmap-container .q4 {
      background-color: ${theme.colors.success.base};
      fill: ${theme.colors.success.base};
    }

    .cal-heatmap-container .q5 {
      background-color: ${theme.colors.success.dark1};
      fill: ${theme.colors.success.dark1};
    }

    .cal-heatmap-container rect.highlight {
      stroke: ${theme.colors.grayscale.dark1};
      stroke-width: 1;
    }

    .cal-heatmap-container text.highlight {
      fill: ${theme.colors.grayscale.dark1};
    }

    .cal-heatmap-container rect.highlight-now {
      stroke: ${theme.colors.error.base};
    }

    .cal-heatmap-container text.highlight-now {
      fill: ${theme.colors.error.base};
      font-weight: ${theme.typography.weights.bold};
    }

    .cal-heatmap-container .domain-background {
      fill: none;
      shape-rendering: crispedges;
    }

    .ch-tooltip {
      padding: ${theme.gridUnit * 2}px;
      background: ${theme.colors.grayscale.dark1};
      color: ${theme.colors.grayscale.light1};
      font-size: ${theme.typography.sizes.s}px;
      line-height: 1.4;
      width: 140px;
      position: absolute;
      z-index: 99999;
      text-align: center;
      border-radius: ${theme.borderRadius}px;
      box-shadow: 2px 2px 2px ${theme.colors.grayscale.dark2};
      display: none;
      box-sizing: border-box;
    }

    .ch-tooltip::after {
      position: absolute;
      width: 0;
      height: 0;
      border-color: transparent;
      border-style: solid;
      content: '';
      padding: 0;
      display: block;
      bottom: -${theme.gridUnit}px;
      left: 50%;
      margin-left: -${theme.gridUnit}px;
      border-width: ${theme.gridUnit}px ${theme.gridUnit}px 0;
      border-top-color: ${theme.colors.grayscale.dark1};
    }
  `}
`;
