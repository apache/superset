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

import React from 'react';
import { StickyContainer, Sticky } from 'react-sticky';
import { styled } from '@superset-ui/core';
import cx from 'classnames';

export const SUPERSET_HEADER_HEIGHT = 59;

const Wrapper = styled.div`
  position: relative;
  width: 16px;
  flex: 0 0 16px;
  /* these animations (which can be enabled with the "animated" class) look glitchy due to chart resizing */
  /* keeping these for posterity, in case we can improve that resizing performance */
  /* &.animated {
    transition: width 0;
    transition-delay: ${({ theme }) =>
    theme.transitionTiming * 2}s;
  } */
  &.open {
    width: 250px;
    flex: 0 0 250px;
    /* &.animated {
      transition-delay: 0s;
    } */
  }
`;

const Contents = styled.div`
  display: grid;
  position: absolute;
  overflow: auto;
  height: 100%;
`;

export interface SVBProps {
  topOffset: number;
  width: number;
  filtersOpen: boolean;
}

/**
 * A vertical sidebar that uses sticky position to stay
 * fixed on the page after the sitenav is scrolled out of the viewport.
 *
 * TODO use css position: sticky when sufficiently supported
 * (should have better performance)
 */
export const StickyVerticalBar: React.FC<SVBProps> = ({
  topOffset,
  children,
  filtersOpen,
}) => {
  return (
    <Wrapper className={cx({ open: filtersOpen })}>
      <StickyContainer>
        <Sticky topOffset={-topOffset} bottomOffset={Infinity}>
          {({
            style,
            isSticky,
            distanceFromTop,
          }: {
            style: any;
            isSticky: boolean;
            distanceFromTop: number;
          }) => (
            <Contents
              style={
                isSticky
                  ? {
                      ...style,
                      top: topOffset,
                      height: `calc(100vh - ${topOffset}px)`,
                    }
                  : {
                      height: `calc(100vh - ${distanceFromTop}px)`,
                    }
              }
            >
              {children}
            </Contents>
          )}
        </Sticky>
      </StickyContainer>
    </Wrapper>
  );
};
