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
import { useState, ReactNode, useLayoutEffect, RefObject } from 'react';

import { css, styled, Metric, SupersetTheme } from '@superset-ui/core';
import {
  SafeMarkdown,
  Typography,
  // TODO: somehow doesn't work with our main Tooltip (?)
  RawAntdTooltip as Tooltip,
  InfoTooltip,
} from '@superset-ui/core/components';
import { ColumnTypeLabel } from './ColumnTypeLabel/ColumnTypeLabel';
import CertifiedIconWithTooltip from './CertifiedIconWithTooltip';
import { getMetricTooltipNode } from './labelUtils';
import { SQLPopover } from './SQLPopover';

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;

  > svg {
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

export interface MetricOptionProps {
  metric: Omit<Metric, 'id' | 'uuid'> & { label?: string };
  openInNewWindow?: boolean;
  showFormula?: boolean;
  showType?: boolean;
  url?: string;
  labelRef?: RefObject<any>;
  shouldShowTooltip?: boolean;
}

export function MetricOption({
  metric,
  labelRef,
  openInNewWindow = false,
  showFormula = true,
  showType = false,
  shouldShowTooltip = true,
  url = '',
}: MetricOptionProps) {
  const verbose = metric.verbose_name || metric.metric_name || metric.label;

  const label = (
    <span
      className="option-label metric-option-label"
      css={(theme: SupersetTheme) => css`
        margin-right: ${theme.sizeUnit}px;
      `}
      ref={labelRef}
    >
      {url ? (
        <Typography.Link
          href={url}
          target={openInNewWindow ? '_blank' : ''}
          rel="noreferrer"
        >
          {verbose}
        </Typography.Link>
      ) : (
        verbose
      )}
    </span>
  );

  const warningMarkdown =
    metric.warning_markdown || metric.warning_text || metric.error_text;

  const [tooltipText, setTooltipText] = useState<ReactNode>(metric.metric_name);

  useLayoutEffect(() => {
    setTooltipText(getMetricTooltipNode(metric, labelRef));
  }, [labelRef, metric]);

  return (
    <FlexRowContainer className="metric-option">
      {showType && <ColumnTypeLabel type="expression" />}
      {shouldShowTooltip ? (
        <Tooltip id="metric-name-tooltip" title={tooltipText}>
          {label}
        </Tooltip>
      ) : (
        label
      )}
      {showFormula && metric.expression && (
        <SQLPopover sqlExpression={metric.expression} />
      )}
      {metric.is_certified && (
        <CertifiedIconWithTooltip
          metricName={metric.metric_name}
          certifiedBy={metric.certified_by}
          details={metric.certification_details}
        />
      )}
      {warningMarkdown && (
        <InfoTooltip
          type="warning"
          tooltip={<SafeMarkdown source={warningMarkdown} />}
          label={`warn-${metric.metric_name}`}
          iconStyle={{ marginLeft: 0 }}
          {...(metric.error_text && {
            type: 'error',
          })}
        />
      )}
    </FlexRowContainer>
  );
}
