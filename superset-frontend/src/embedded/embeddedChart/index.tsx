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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { css, styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { AntdThemeProvider, Loading } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components/ErrorBoundary';
import Chart from 'src/dashboard/components/gridComponents/Chart';
import getBootstrapData from 'src/utils/getBootstrapData';
import { setDatasources } from 'src/dashboard/actions/datasources';
import useExploreData from './useExploreData';
import hydrateEmbedded from './hydrateEmbedded';

/**
 * Fills the iframe. The chart is measured by its container rather than the
 * dashboard grid, so the wrapper owns the dimensions the dashboard would
 * normally supply.
 */
const Fill = styled.div`
  ${() => css`
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `}
`;

/**
 * The dashboard gives each chart a holder element that owns two things the
 * header controls reach for: the node passed to `requestFullscreen`, and the
 * `dashboard-chart-id-<id>` class the screenshot exports select on. An embedded
 * chart renders without `ChartHolder`, so it has to provide both itself.
 */
const Holder = styled.div`
  ${() => css`
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  `}
`;

const useContainerSize = (): { width: number; height: number } => {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEffect(() => {
    const onResize = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
};

export default function EmbeddedChart({ chartId }: { chartId: string }) {
  const dispatch = useDispatch();
  const { data, loading, error } = useExploreData(chartId);
  const { width, height } = useContainerSize();
  const [hydrated, setHydrated] = useState(false);
  const [isFullSize, setIsFullSize] = useState(false);
  const holderRef = useRef<HTMLDivElement>(null);

  const handleToggleFullSize = useCallback(() => {
    setIsFullSize(current => !current);
  }, []);

  useEffect(() => {
    if (!data) return;
    const bootstrapData = getBootstrapData();
    // `datasources` has no HYDRATE_DASHBOARD handler, so it is populated
    // through its own action rather than the hydrate payload.
    dispatch(setDatasources([data.dataset]));
    dispatch(hydrateEmbedded(data, bootstrapData.common));
    setHydrated(true);
  }, [data, dispatch]);

  if (loading || (!hydrated && !error)) return <Loading />;
  if (error || !data) return <div>{error ?? t('The chart could not be loaded.')}</div>;

  return (
    <Fill>
      <ErrorBoundary>
        <Holder
          ref={holderRef}
          className={`dashboard-chart-id-${data.slice.slice_id}`}
        >
          <AntdThemeProvider
            getPopupContainer={(triggerNode?: HTMLElement) => {
              // Only the fullscreen element's subtree is painted, so popups
              // have to be portaled into it rather than to document.body,
              // otherwise the header menu is unreachable while fullscreen.
              const fullscreenElement =
                document.fullscreenElement as HTMLElement | null;
              return triggerNode && fullscreenElement?.contains(triggerNode)
                ? fullscreenElement
                : document.body;
            }}
          >
            <Chart
              id={data.slice.slice_id}
              componentId={`EMBEDDED_CHART-${data.slice.slice_id}`}
              // There is no dashboard behind an embedded chart; the fabricated
              // state is keyed by slice id and nothing reads this as a lookup.
              dashboardId={0}
              width={width}
              height={height}
              sliceName={data.slice.slice_name}
              isComponentVisible
              isInView
              chartHolderRef={holderRef}
              isFullSize={isFullSize}
              handleToggleFullSize={handleToggleFullSize}
              // Renaming is a dashboard-owner action with no meaning here.
              updateSliceName={() => {}}
            />
          </AntdThemeProvider>
        </Holder>
      </ErrorBoundary>
    </Fill>
  );
}
