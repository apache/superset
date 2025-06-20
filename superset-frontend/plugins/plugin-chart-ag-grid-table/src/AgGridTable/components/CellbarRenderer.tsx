/* eslint-disable camelcase */
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

import { InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from '@superset-ui/chart-controls';
import { t, styled } from '@superset-ui/core';

const StyledTotalCell = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.typography.weights.bold};
  `}
`;

const SummaryContainer = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.gridUnit}px;
  `}
`;

const SummaryText = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.typography.weights.bold};
  `}
`;

const SUMMARY_TOOLTIP_TEXT = t(
  'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
);

const Bar = styled.div<{
  offset: number;
  percentage: number;
  background: string;
}>`
  position: absolute;
  left: ${({ offset }) => `${offset}%`};
  top: 0;
  height: 100%;
  width: ${({ percentage }) => `${percentage}%`};
  background-color: ${({ background }) => background};
  z-index: 1;
`;

const CellContainer = styled.div<{ backgroundColor?: string; align?: string }>`
  display: flex;
  background-color: ${({ backgroundColor }) =>
    backgroundColor || 'transparent'};
  justify-content: ${({ align }) => align || 'left'};
`;

const ArrowContainer = styled.div<{ arrowColor?: string }>`
  margin-right: 10px;
  color: ${({ arrowColor }) => arrowColor || 'inherit'};
`;

export default function CellBarRenderer({
  value,
  percentage,
  offset,
  background,
}: {
  value: number;
  percentage: number;
  offset: number;
  background: string;
}) {
  return (
    <div>
      <Bar offset={offset} percentage={percentage} background={background} />
      {value}
    </div>
  );
}

export const TotalsRenderer = ({
  value = '',
  isSummaryText = false,
}: {
  value?: string;
  isSummaryText?: boolean;
}) => {
  if (isSummaryText) {
    return (
      <SummaryContainer>
        <SummaryText>{t('Summary')}</SummaryText>
        <Tooltip overlay={SUMMARY_TOOLTIP_TEXT}>
          <InfoCircleOutlined />
        </Tooltip>
      </SummaryContainer>
    );
  }

  return <StyledTotalCell>{value}</StyledTotalCell>;
};

interface CellRendererProps {
  value: number;
  arrow?: string;
  backgroundColor?: string;
  arrowColor?: string;
  alignment?: string;
}

export const CellRenderer: React.FC<CellRendererProps> = ({
  value,
  backgroundColor,
  arrow,
  arrowColor,
  alignment,
}) => (
  <CellContainer align={alignment} backgroundColor={backgroundColor}>
    {arrow && <ArrowContainer arrowColor={arrowColor}>{arrow}</ArrowContainer>}
    <div>{value}</div>
  </CellContainer>
);
