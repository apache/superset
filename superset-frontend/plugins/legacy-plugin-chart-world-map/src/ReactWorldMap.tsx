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
import { reactify } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/ui';
import WorldMap from './WorldMap';

// Type-erase the render function to allow flexible prop spreading in the wrapper.
// The WorldMap render function has typed props, but the wrapper passes props via spread
// which TypeScript cannot verify at compile time. Props are validated at runtime.
const ReactWorldMap = reactify(
  WorldMap as unknown as (
    container: HTMLDivElement,
    props: Record<string, unknown>,
  ) => void,
);

interface WorldMapComponentProps {
  className: string;
  [key: string]: unknown;
}

const WorldMapComponent = ({
  className,
  ...otherProps
}: WorldMapComponentProps) => {
  const theme = useTheme();
  return (
    <div className={className}>
      <ReactWorldMap {...otherProps} theme={theme} />
    </div>
  );
};

export default styled(WorldMapComponent)`
  .superset-legacy-chart-world-map {
    position: relative;
    svg {
      background-color: ${({ theme }) => theme.colorBgLayout};
    }
  }
  .hoverinfo {
    background-color: ${({ theme }) => theme.colorBgElevated};
    color: ${({ theme }) => theme.colorTextSecondary};
  }
`;
