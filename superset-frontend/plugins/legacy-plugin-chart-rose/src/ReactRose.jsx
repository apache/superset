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
import { reactify, styled, css } from '@superset-ui/core';
import { Global } from '@emotion/react';
import Component from './Rose';

const ReactComponent = reactify(Component);

const Rose = ({ className, ...otherProps }) => (
  <div className={className}>
    <Global
      styles={theme => css`
        .tooltip {
          line-height: 1;
          padding: ${theme.gridUnit * 3}px;
          background: ${theme.colors.grayscale.dark2};
          color: ${theme.colors.grayscale.light5};
          border-radius: 4px;
          pointer-events: none;
          z-index: 1000;
          font-size: ${theme.typography.sizes.s}px;
        }
      `}
    />
    <ReactComponent {...otherProps} />
  </div>
);

export default styled(Rose)`
  ${({ theme }) => `
    .superset-legacy-chart-rose path {
        transition: fill-opacity 180ms linear;
        stroke: ${theme.colors.grayscale.light5};
        stroke-width: 1px;
        stroke-opacity: 1;
        fill-opacity: 0.75;
    }

    .superset-legacy-chart-rose text {
        font-weight: ${theme.typography.weights.normal};
        font-size: ${theme.typography.sizes.s}px;
        font-family: ${theme.typography.families.sansSerif};
        pointer-events: none;
    }

    .superset-legacy-chart-rose .clickable path {
        cursor: pointer;
    }

    .superset-legacy-chart-rose .hover path {
        fill-opacity: 1;
    }

    .nv-legend .nv-series {
        cursor: pointer;
    }
  `}
`;
