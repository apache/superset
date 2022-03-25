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
import React, { useState, ReactNode, useLayoutEffect } from 'react';
import { styled, Metric, SafeMarkdown } from '@superset-ui/core';
import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';
import { ColumnTypeLabel } from './ColumnTypeLabel';
import CertifiedIconWithTooltip from './CertifiedIconWithTooltip';
import Tooltip from './Tooltip';
import { getMetricTooltipNode } from './labelUtils';

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;

  > svg {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

export interface MetricOptionProps {
  metric: Omit<Metric, 'id'> & { label?: string };
  openInNewWindow?: boolean;
  showFormula?: boolean;
  showType?: boolean;
  url?: string;
  labelRef?: React.RefObject<any>;
}

export function MetricOption({
  metric,
  labelRef,
  openInNewWindow = false,
  showFormula = true,
  showType = false,
  url = '',
}: MetricOptionProps) {
  const verbose = metric.verbose_name || metric.metric_name || metric.label;
  const link = url ? (
    <a href={url} target={openInNewWindow ? '_blank' : ''} rel="noreferrer">
      {verbose}
    </a>
  ) : (
    verbose
  );

  const warningMarkdown = metric.warning_markdown || metric.warning_text;

  const [tooltipText, setTooltipText] = useState<ReactNode>(metric.metric_name);

  useLayoutEffect(() => {
    setTooltipText(getMetricTooltipNode(metric, labelRef));
  }, [labelRef, metric]);

  return (
    <FlexRowContainer className="metric-option">
      {showType && <ColumnTypeLabel type="expression" />}
      {metric.is_certified && (
        <CertifiedIconWithTooltip
          metricName={metric.metric_name}
          certifiedBy={metric.certified_by}
          details={metric.certification_details}
        />
      )}
      <Tooltip id="metric-name-tooltip" title={tooltipText}>
        <span className="option-label metric-option-label" ref={labelRef}>
          {link}
        </span>
      </Tooltip>
      {showFormula && (
        <InfoTooltipWithTrigger
          className="text-muted"
          icon="question-circle-o"
          tooltip={metric.expression}
          label={`expr-${metric.metric_name}`}
        />
      )}
      {warningMarkdown && (
        <InfoTooltipWithTrigger
          className="text-warning"
          icon="warning"
          tooltip={<SafeMarkdown source={warningMarkdown} />}
          label={`warn-${metric.metric_name}`}
        />
      )}
    </FlexRowContainer>
  );
}
