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
/* eslint-disable theme-colors/no-literal-colors */
/* eslint-disable consistent-return */
import { useEffect, useRef, useState } from 'react';
import { styled } from '@superset-ui/core';
import Chart from 'src/dashboard/components/gridComponents/Chart';
import Loading from 'src/components/Loading';
import { store } from 'src/views/store';
import getBootstrapData from 'src/utils/getBootstrapData';
import useExploreData from './useExploreData';
import hydrateEmbedded from './hydrateEmbedded';

// Styled Components
const Container = styled.div`
  width: 100%;
  min-height: 400px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
`;

const LoadingContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

interface Dimensions {
  width: number;
  height: number;
}

function EmbeddedChart({ sliceId }: { sliceId: number }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDimensionsSet, setIsDimensionsSet] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions | null>(null);
  const { common } = getBootstrapData();

  // Get app element dimensions
  useEffect(() => {
    if (!isHydrated) return;

    const appElement = document.getElementById('app');
    if (!appElement) {
      console.warn('App element not found');
      return;
    }

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        const newWidth = Math.floor(width);
        const newHeight = Math.floor(height);

        if (!dimensions) {
          // Initial dimensions set
          setDimensions({
            width: newWidth,
            height: newHeight,
          });
          setIsDimensionsSet(true);
          return;
        }

        const widthDiff = Math.abs(newWidth - dimensions.width);
        const heightDiff = Math.abs(newHeight - dimensions.height);

        // Only update if either dimension has changed by more than 3px
        if (widthDiff > 3 || heightDiff > 3) {
          setDimensions({
            width: newWidth,
            height: newHeight,
          });
        }
      }
    });

    resizeObserver.observe(appElement);

    return () => {
      resizeObserver.unobserve(appElement);
      resizeObserver.disconnect();
    };
  }, [isHydrated, dimensions]);

  const { data: exploreData, isLoading, error } = useExploreData(sliceId);

  useEffect(() => {
    if (exploreData?.result) {
      try {
        // store must be immediately hydrated with
        // necessary data for initial render
        store.dispatch(hydrateEmbedded(exploreData.result, common));
        setIsHydrated(true);
      } catch (err) {
        console.error('Error dispatching hydrate action:', err);
      }
    }
  }, [exploreData]);

  if (isLoading || !isHydrated || !isDimensionsSet || !dimensions) {
    return <Loading />;
  }

  if (error) {
    return <LoadingContainer>Error: {error}</LoadingContainer>;
  }

  // @ts-ignore
  const chartId = exploreData?.result?.slice?.slice_id;
  // @ts-ignore
  const chartName = exploreData?.result?.slice?.slice_name || '';

  if (!chartId) {
    return <LoadingContainer>Invalid chart data</LoadingContainer>;
  }

  return (
    <Container ref={containerRef}>
      <Chart
        id={chartId}
        componentId=""
        dashboardId={0}
        width={dimensions.width - 20}
        height={dimensions.height - 20}
        sliceName={chartName}
        updateSliceName={() => {}}
        isComponentVisible
        handleToggleFullSize={() => {}}
        setControlValue={() => {}}
        extraControls={{}}
        isInView
      />
    </Container>
  );
}

export default EmbeddedChart;
