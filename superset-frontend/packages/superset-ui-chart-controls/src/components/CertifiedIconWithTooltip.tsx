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
import { kebabCase } from 'lodash';
import { t, useTheme, styled } from '@superset-ui/core';
import Tooltip from './Tooltip';

interface CertifiedIconWithTooltipProps {
  certifiedBy?: string | null;
  details?: string | null;
  metricName: string;
}

const StyledDiv = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
`;

function CertifiedIconWithTooltip({
  certifiedBy,
  details,
  metricName,
}: CertifiedIconWithTooltipProps) {
  const theme = useTheme();
  return (
    <Tooltip
      id={`${kebabCase(metricName)}-tooltip`}
      title={
        <div>
          {certifiedBy && (
            <StyledDiv>{t('Certified by %s', certifiedBy)}</StyledDiv>
          )}
          <div>{details}</div>
        </div>
      }
    >
      {/* TODO: move Icons to superset-ui to remove duplicated icon code here */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        enableBackground="new 0 0 24 24"
        height="16"
        viewBox="0 0 24 24"
        width="16"
      >
        <g>
          <path
            fill={theme.colors.primary.base}
            d="M23,12l-2.44-2.79l0.34-3.69l-3.61-0.82L15.4,1.5L12,2.96L8.6,1.5L6.71,4.69L3.1,5.5L3.44,9.2L1,12l2.44,2.79l-0.34,3.7 l3.61,0.82L8.6,22.5l3.4-1.47l3.4,1.46l1.89-3.19l3.61-0.82l-0.34-3.69L23,12z M9.38,16.01L7,13.61c-0.39-0.39-0.39-1.02,0-1.41 l0.07-0.07c0.39-0.39,1.03-0.39,1.42,0l1.61,1.62l5.15-5.16c0.39-0.39,1.03-0.39,1.42,0l0.07,0.07c0.39,0.39,0.39,1.02,0,1.41 l-5.92,5.94C10.41,16.4,9.78,16.4,9.38,16.01z"
          />
        </g>
      </svg>
    </Tooltip>
  );
}

export default CertifiedIconWithTooltip;
