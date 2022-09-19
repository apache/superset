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
import { reactify, styled } from '@superset-ui/core';
import PropTypes from 'prop-types';
import SanKey from './Sankey';

const ReactSanKey = reactify(SanKey);

const SankeyComponent = ({ className, ...otherProps }) => (
  <div className={className}>
    <ReactSanKey {...otherProps} />
  </div>
);

SankeyComponent.propTypes = {
  className: PropTypes.string.isRequired,
};

export default styled(SankeyComponent)`
  ${({ theme }) => `
    .superset-legacy-chart-sankey {
      .node {
        rect {
          cursor: move;
          fill-opacity: ${theme.opacity.heavy};
          shape-rendering: crispEdges;
        }
        text {
          pointer-events: none;
          text-shadow: 0 1px 0 ${theme.colors.grayscale.light5};
          font-size: ${theme.typography.sizes.s}px;
        }
      }
      .link {
        fill: none;
        stroke: ${theme.colors.grayscale.dark2};
        stroke-opacity: ${theme.opacity.light};
        &:hover {
          stroke-opacity: ${theme.opacity.mediumLight};
        }
      }
      .opacity-0 {
        opacity: 0;
      }
    }
    .sankey-tooltip {
      position: absolute;
      width: auto;
      background: ${theme.colors.grayscale.light2};
      padding: ${theme.gridUnit * 3}px;
      font-size: ${theme.typography.sizes.s}px;
      color: ${theme.colors.grayscale.dark2};
      border: 1px solid ${theme.colors.grayscale.light5};
      text-align: center;
      pointer-events: none;
    }
  `}
`;
