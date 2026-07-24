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
/* eslint-disable react/no-array-index-key */
import { memo } from 'react';
import { styled } from '@apache-superset/core/theme';
import TTestTable, { DataEntry } from './TTestTable';

interface PairedTTestProps {
  alpha?: number;
  className?: string;
  data: Record<string, DataEntry[]>;
  groups: string[];
  height?: number;
  liftValPrec?: number;
  metrics: string[];
  pValPrec?: number;
}

const StyledDiv = styled.div`
  ${({ theme }) => `
    /* The chart's allotted height is applied inline; scroll when the tables
       overflow it (e.g. many groups across multiple metrics). */
    overflow: auto;
    padding: 0 ${theme.sizeUnit}px;

    h3 {
      margin-left: ${theme.sizeUnit}px;
    }

    /* Space the per-metric tables apart */
    & > div + div {
      margin-top: ${theme.sizeUnit * 2}px;
    }

    /* Keep the numeric columns aligned with tabular figures */
    td {
      font-feature-settings: 'tnum' 1;
    }
  `}
`;

function PairedTTest({
  alpha = 0.05,
  className = '',
  data,
  groups,
  height,
  liftValPrec = 4,
  metrics,
  pValPrec = 6,
}: PairedTTestProps) {
  return (
    <StyledDiv className={className} style={{ height }}>
      {metrics.map((metric, i) => (
        <TTestTable
          key={i}
          metric={metric}
          groups={groups}
          data={data[metric]}
          alpha={alpha}
          pValPrec={Math.min(pValPrec, 32)}
          liftValPrec={Math.min(liftValPrec, 32)}
        />
      ))}
    </StyledDiv>
  );
}

// memo preserves the shallow-prop render bailout of the PureComponent original
export default memo(PairedTTest);
