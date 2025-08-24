import { useSelector } from 'react-redux';
import { styled } from '@superset-ui/core';
import ExploreViewContainer from 'src/explore/components/ExploreViewContainer';

const StyledPortableExplore = styled.div`
  ${({ theme }) => `
    width: 100%;
    height: 100%;

    // Override some of the ExploreViewContainer styles for modal context
    .explore-container {
      height: 500px;
      overflow: hidden;
    }

    // Hide the header since we're in a modal
    .explore-chart-header {
      display: none;
    }

    // Adjust panel sizes for modal
    .data-source-selection {
      max-width: 250px;
    }

    .controls-column {
      max-width: 300px;
    }
  `}
`;

const PortableExplore = () => {
  // Check if explore state is ready - ExploreViewContainer will get props from Redux automatically
  const exploreState = useSelector((state: any) => state.explore);
  const charts = useSelector((state: any) => state?.charts || {});
  const sliceId = useSelector(
    (state: any) => state?.explore?.form_data?.slice_id,
  );

  // Early return if explore state is not ready
  if (
    !exploreState ||
    !exploreState.form_data ||
    !exploreState.datasource ||
    !charts?.[sliceId]
  ) {
    return (
      <StyledPortableExplore>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '400px',
          }}
          css={(theme: any) => `
            color: ${theme.colorTextSecondary};
          `}
        >
          Select a dataset to start building your chart
        </div>
      </StyledPortableExplore>
    );
  }

  // ExploreViewContainer is connected to Redux and will get all props automatically
  return (
    <StyledPortableExplore>
      <ExploreViewContainer />
    </StyledPortableExplore>
  );
};

export default PortableExplore;
