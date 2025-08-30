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
  const sliceId = 0;

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
