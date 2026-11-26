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
import { useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import {
  Button,
  EmptyState,
  Skeleton,
  Space,
  Typography,
} from '@superset-ui/core/components';

export type SkeletonShape = 'chart' | 'metric' | 'table' | 'text';

const Fill = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;

  .ant-skeleton-node,
  .ant-skeleton-element {
    width: 100%;
    height: 100%;
  }
`;

/** A placeholder roughly the shape of what is loading. */
export function WidgetSkeleton({ shape }: { shape: SkeletonShape }) {
  return (
    <Fill data-test="canvas-widget-loading" aria-busy="true">
      {shape === 'chart' && <Skeleton.Node active />}
      {shape === 'metric' && (
        <Skeleton active title={{ width: '40%' }} paragraph={false} />
      )}
      {shape === 'table' && (
        <Skeleton active title={false} paragraph={{ rows: 5 }} />
      )}
      {shape === 'text' && <Skeleton active paragraph={{ rows: 3 }} />}
    </Fill>
  );
}

/** What a widget shows when its query returned no rows. */
export function WidgetNoData({ filtered }: { filtered: boolean }) {
  return (
    <Fill data-test="canvas-widget-no-data">
      <EmptyState
        size="small"
        image="filter-results.svg"
        title={
          filtered ? t('No results for the current filters') : t('No results')
        }
        description={null}
      />
    </Fill>
  );
}

const Details = styled(Typography.Paragraph)`
  ${({ theme }) => css`
    && {
      margin: 0;
      max-width: 100%;
      font-size: ${theme.fontSizeSM}px;
      overflow-wrap: anywhere;
    }
  `}
`;

/** A query that failed, said plainly, with the raw message on request. */
export function WidgetError({
  title = t("This widget's data couldn't be loaded."),
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Fill data-test="canvas-widget-error" role="alert">
      <EmptyState size="small" image={null} title={title} description={null}>
        <Space size="small" wrap>
          {onRetry && (
            <Button
              buttonSize="small"
              buttonStyle="secondary"
              onClick={onRetry}
            >
              {t('Retry')}
            </Button>
          )}
          <Button
            buttonSize="small"
            buttonStyle="link"
            aria-expanded={open}
            onClick={() => setOpen(shown => !shown)}
          >
            {t('Details')}
          </Button>
        </Space>
        {open && <Details type="secondary">{message}</Details>}
      </EmptyState>
    </Fill>
  );
}
