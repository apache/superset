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

/**
 * @fileoverview A chart rendered inside a chat message.
 *
 * The assistant does not send a chart, it sends a `form_data_key` it stored — so
 * what arrives in the transcript is a reference the client resolves, and the
 * rendered chart is the real thing, with the real permissions, rather than an
 * image of one.
 *
 * The awkward part is timing: the key can exist before the query behind it has
 * finished. Rather than show the chart's own "No data" state (which reads as a
 * broken answer) the component keeps a spinner up and re-renders on a growing
 * backoff until rows appear, giving up after a bounded number of attempts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type QueryFormData,
  StatefulChart,
  SupersetClient,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Loading } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { ErrorBoundary } from 'src/components/ErrorBoundary';

const VALID_KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 800;
const DEFAULT_HEIGHT = 300;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1500, 3000];

/** Width used until the container has been measured. */
const FALLBACK_CHART_WIDTH = 600;

// Backoff for the "waiting for chart data" poll. The delay grows exponentially
// per attempt up to a ceiling, so a slow query is waited out without hammering
// the backend.
const POLL_BASE_DELAY_MS = 1000;
const POLL_MAX_DELAY_MS = 30_000;

/**
 * Polling stops after this many attempts.
 *
 * A retry re-issues the chart's data request, which will use the results cache if
 * the query has landed but will otherwise execute it. Polling forever would keep
 * re-issuing it, so an unfinished query surfaces the retry control instead.
 */
const MAX_POLL_ATTEMPTS = 6;

const getPollDelayMs = (attempt: number): number =>
  Math.min(POLL_BASE_DELAY_MS * 2 ** attempt, POLL_MAX_DELAY_MS);

export interface ChartEmbedParams {
  formDataKey: string | null;
  height: number;
  title: string | null;
}

/**
 * Parse key=value lines from the content of a ```superset-chart fenced block.
 *
 * Rules are strict on purpose: the block is model output, so `form_data_key` must
 * match `/^[a-zA-Z0-9_-]+$/` before it reaches a URL, and `height` is clamped.
 * Unknown keys are ignored so a newer backend can add some without breaking an
 * older client.
 */
export function parseChartEmbedParams(codeText: string): ChartEmbedParams {
  const result: ChartEmbedParams = {
    formDataKey: null,
    height: DEFAULT_HEIGHT,
    title: null,
  };

  const lines = codeText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  lines.forEach(line => {
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) {
      return;
    }

    const key = line.slice(0, eqIndex).trim().toLowerCase();
    const value = line.slice(eqIndex + 1).trim();

    if (key === 'form_data_key') {
      if (value && VALID_KEY_PATTERN.test(value)) {
        result.formDataKey = value;
      }
      return;
    }
    if (key === 'height') {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        result.height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, parsed));
      }
      return;
    }
    if (key === 'title' && value) {
      result.title = value;
    }
  });

  return result;
}

const ChartContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  overflow: hidden;
  margin: ${({ theme }) => theme.sizeUnit * 2}px 0;
  background: ${({ theme }) => theme.colorBgContainer};
`;

const ChartHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.sizeUnit * 2}px
    ${({ theme }) => theme.sizeUnit * 3}px;
  border-bottom: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  background: ${({ theme }) => theme.colorBgLayout};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

const ChartTitle = styled.span`
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  color: ${({ theme }) => theme.colorText};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
`;

const ChartActions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  align-items: center;
  flex-shrink: 0;
  margin-left: ${({ theme }) => theme.sizeUnit * 2}px;
`;

const ActionLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit / 2}px;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorPrimary};
  cursor: pointer;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit / 2}px;
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  color: ${({ theme }) => theme.colorTextSecondary};
  cursor: pointer;
  background: none;
  border: none;
  padding: 2px ${({ theme }) => theme.sizeUnit / 2}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;

  &:hover {
    color: ${({ theme }) => theme.colorPrimary};
    background: ${({ theme }) => theme.colorFillTertiary};
  }
`;

const ChartBody = styled.div<{ height: number }>`
  height: ${({ height }) => height}px;
  position: relative;
`;

// Covers the chart while it reports no data, hiding the underlying "No data"
// state (which looks broken) behind a spinner while refreshing continues.
const ChartDataOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.sizeUnit * 3}px;
  background: ${({ theme }) => theme.colorBgContainer};
  color: ${({ theme }) => theme.colorTextSecondary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  z-index: 2;
`;

const CenteredMessage = styled.div<{ height: number }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: ${({ height }) => height}px;
  color: ${({ theme }) => theme.colorTextSecondary};
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  text-align: center;
  padding: ${({ theme }) => theme.sizeUnit * 4}px;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
`;

interface ChatChartEmbedProps {
  formDataKey: string;
  height?: number;
  title?: string;
}

type FetchState =
  | { status: 'loading' }
  | { status: 'loaded'; formData: QueryFormData }
  | { status: 'error'; message: string };

const exploreUrlFor = (formDataKey: string): string =>
  `/explore/?form_data_key=${encodeURIComponent(formDataKey)}`;

export function ChatChartEmbedInner({
  formDataKey,
  height = DEFAULT_HEIGHT,
  title,
}: ChatChartEmbedProps) {
  const [fetchState, setFetchState] = useState<FetchState>({
    status: 'loading',
  });
  const [chartWidth, setChartWidth] = useState(0);
  const [chartRenderKey, setChartRenderKey] = useState(0);
  // True while the chart's query results are still unavailable (either an empty
  // result or a cache miss), which is what keeps the overlay up.
  const [isAwaitingData, setIsAwaitingData] = useState(false);
  const chartBodyRef = useRef<HTMLDivElement>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Bumping `chartRenderKey` remounts the chart, which re-issues its data
  // request. `force` is left off so the results cache is preferred.
  const scheduleNextPoll = useCallback(() => {
    if (chartRenderKey >= MAX_POLL_ATTEMPTS) {
      setIsAwaitingData(false);
      return;
    }
    setIsAwaitingData(true);
    const delay = getPollDelayMs(chartRenderKey);
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }
    pollTimeoutRef.current = setTimeout(
      () => setChartRenderKey(key => key + 1),
      delay,
    );
  }, [chartRenderKey]);

  useEffect(
    () => () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const element = chartBodyRef.current;
    if (!element) {
      return undefined;
    }

    const initialWidth = Math.floor(element.getBoundingClientRect().width);
    if (initialWidth > 0) {
      setChartWidth(initialWidth);
    }

    // The panel is resizable by the host, so the chart is measured rather than
    // given a fixed width.
    const observer = new ResizeObserver(entries => {
      const [entry] = entries;
      if (entry) {
        const width = Math.floor(entry.contentRect.width);
        if (width > 0) {
          setChartWidth(width);
        }
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fetchState.status]);

  const exploreUrl = exploreUrlFor(formDataKey);

  const fetchFormData = useCallback(
    async (attempt: number = 0) => {
      setFetchState({ status: 'loading' });
      setIsAwaitingData(false);
      setChartRenderKey(0);

      const retry = (): boolean => {
        if (attempt >= MAX_RETRIES) {
          return false;
        }
        const delay = RETRY_DELAYS_MS[attempt] ?? 1000;
        setTimeout(() => {
          fetchFormData(attempt + 1);
        }, delay);
        return true;
      };

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          FETCH_TIMEOUT_MS,
        );

        const response = await SupersetClient.get({
          endpoint: `/api/v1/explore/form_data/${encodeURIComponent(formDataKey)}`,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const raw = response.json;
        const formDataStr =
          typeof raw === 'string'
            ? raw
            : ((raw as { form_data?: string })?.form_data ?? undefined);

        if (!formDataStr) {
          // The key can be written before the payload is readable, so an empty
          // body is treated as "not yet" rather than "gone".
          if (retry()) {
            return;
          }
          setFetchState({
            status: 'error',
            message: t('Chart configuration not found or expired.'),
          });
          return;
        }

        const parsed: QueryFormData =
          typeof formDataStr === 'string'
            ? JSON.parse(formDataStr)
            : formDataStr;

        if (!parsed.viz_type) {
          setFetchState({
            status: 'error',
            message: t(
              'Invalid chart configuration: missing visualization type.',
            ),
          });
          return;
        }

        // Defaults the chart pipeline requires but a stored form_data may omit.
        if (!parsed.time_range) {
          parsed.time_range = 'No filter';
        }
        if (!parsed.result_format) {
          parsed.result_format = 'json';
        }
        if (!parsed.result_type) {
          parsed.result_type = 'full';
        }

        setFetchState({ status: 'loaded', formData: parsed });
      } catch (caught) {
        if (retry()) {
          return;
        }
        const errorMessage =
          caught instanceof DOMException && caught.name === 'AbortError'
            ? t('Chart loading timed out.')
            : t('Unable to load chart preview.');
        setFetchState({ status: 'error', message: errorMessage });
      }
    },
    [formDataKey],
  );

  useEffect(() => {
    fetchFormData();
  }, [fetchFormData]);

  return (
    <ChartContainer data-test="chat-chart-embed">
      <ChartHeader>
        <ChartTitle>{title ?? t('Chart Preview')}</ChartTitle>
        <ChartActions>
          {fetchState.status === 'error' && (
            <ActionButton
              type="button"
              onClick={() => {
                fetchFormData(0);
              }}
            >
              <Icons.ReloadOutlined iconSize="s" /> {t('Retry')}
            </ActionButton>
          )}
          <ActionLink
            href={exploreUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icons.ExpandOutlined iconSize="s" /> {t('Open in Explore')}
          </ActionLink>
        </ChartActions>
      </ChartHeader>

      {fetchState.status === 'loading' && (
        <CenteredMessage height={height}>
          <Loading position="inline-centered" size="s" />
          {t('Loading chart preview...')}
        </CenteredMessage>
      )}

      {fetchState.status === 'error' && (
        <CenteredMessage height={Math.min(height, 120)}>
          <span>{fetchState.message}</span>
          <ActionLink
            href={exploreUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icons.ExpandOutlined iconSize="s" /> {t('View in Explore instead')}
          </ActionLink>
        </CenteredMessage>
      )}

      {fetchState.status === 'loaded' && (
        <ChartBody height={height} ref={chartBodyRef}>
          <StatefulChart
            key={chartRenderKey}
            formData={fetchState.formData}
            width={chartWidth || FALLBACK_CHART_WIDTH}
            height={height}
            onLoad={queryData => {
              const isEmpty = queryData.every(
                result =>
                  !result.data ||
                  (Array.isArray(result.data) && result.data.length === 0),
              );
              if (isEmpty) {
                scheduleNextPoll();
              } else {
                setIsAwaitingData(false);
              }
            }}
            onError={() => {
              // On a retry an error is usually the query still not being ready,
              // so keep waiting. The first attempt's genuine errors are left to
              // surface through the chart's own error UI.
              if (chartRenderKey > 0) {
                scheduleNextPoll();
              }
            }}
          />
          {isAwaitingData && (
            <ChartDataOverlay>
              <Loading position="inline-centered" size="s" />
              {t('Loading chart data...')}
            </ChartDataOverlay>
          )}
        </ChartBody>
      )}
    </ChartContainer>
  );
}

export function ChartEmbedFallback({
  height,
  formDataKey,
}: {
  height: number;
  formDataKey: string;
}) {
  return (
    <ChartContainer>
      <CenteredMessage height={Math.min(height, 120)}>
        <span>{t('Something went wrong rendering this chart.')}</span>
        <ActionLink
          href={exploreUrlFor(formDataKey)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icons.ExpandOutlined iconSize="s" /> {t('Open in Explore instead')}
        </ActionLink>
      </CenteredMessage>
    </ChartContainer>
  );
}

/**
 * A crash in one embedded chart must not take the transcript with it, so the
 * chart is isolated and replaced by a link to Explore if it throws.
 *
 * `ErrorBoundary` renders nothing when it catches, so the fallback is rendered
 * here off state the boundary sets, which keeps this a function component.
 */
export default function ChatChartEmbed(props: ChatChartEmbedProps) {
  const { formDataKey, height = DEFAULT_HEIGHT } = props;
  const [crashed, setCrashed] = useState(false);

  if (crashed) {
    return <ChartEmbedFallback height={height} formDataKey={formDataKey} />;
  }

  return (
    <ErrorBoundary showMessage={false} onError={() => setCrashed(true)}>
      <ChatChartEmbedInner {...props} />
    </ErrorBoundary>
  );
}
