/* eslint-disable theme-colors/no-literal-colors */
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { styled } from '@superset-ui/core';
import Chart from 'src/dashboard/components/gridComponents/Chart';
import useExploreData from './useExploreData';
import hydrateEmbedded from './hydrateEmbedded';

// Styled Components
const Container = styled.div`
  width: 100%;
  height: 100%;
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

function EmbeddedChart() {
  const dispatch = useDispatch();
  const [isHydrated, setIsHydrated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: 800,
    height: 600,
  });

  // Get container dimensions after mount and hydration
  useEffect(() => {
    if (!containerRef.current || !isHydrated) return;

    const observeTarget = containerRef.current;
    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        const newWidth = Math.floor(width);
        const newHeight = Math.floor(height);

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
    resizeObserver.observe(observeTarget);

    /* eslint-disable consistent-return */
    return () => {
      resizeObserver.unobserve(observeTarget);
      resizeObserver.disconnect();
    };
  }, [isHydrated, dimensions]);

  const { data: exploreData, isLoading, error } = useExploreData(118);

  useEffect(() => {
    if (exploreData?.result) {
      dispatch(hydrateEmbedded(exploreData.result));
      setIsHydrated(true);
    }
  }, [exploreData, dispatch]);

  if (isLoading || !isHydrated) {
    return <LoadingContainer>Loading...</LoadingContainer>;
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
        width={dimensions.width}
        height={dimensions.height}
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
