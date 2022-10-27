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

import { styled } from '@superset-ui/core';
import React from 'react';

export interface FilterDividerProps {
  title: string;
  description: string;
  horizontal?: boolean;
  horizontalOverflow?: boolean;
}

const VerticalWrapper = styled.div``;
const HorizontalWrapper = styled.div``;

const HorizontalOverflowWrapper = styled.div``;

const VerticalTitle = styled.h3``;
const HorizontalTitle = styled.h3``;
const HorizontalOverflowTitle = styled.h3``;

const VerticalDescription = styled.p``;
const HorizontalDescription = styled.p``;
const HorizontalOverflowDescription = styled.p``;

const FilterDivider = ({
  title,
  description,
  horizontal = false,
  horizontalOverflow = false,
}: FilterDividerProps) => {
  let Wrapper = VerticalWrapper;
  let Title = VerticalTitle;
  let Description = VerticalDescription;

  if (horizontal) {
    if (horizontalOverflow) {
      Wrapper = HorizontalOverflowWrapper;
      Title = HorizontalOverflowTitle;
      Description = HorizontalOverflowDescription;
    }

    Wrapper = HorizontalWrapper;
    Title = HorizontalTitle;
    Description = HorizontalDescription;
  }

  return (
    <Wrapper>
      <Title>{title}</Title>
      {description ? (
        <Description data-test="divider-description">{description}</Description>
      ) : null}
    </Wrapper>
  );
};

export default FilterDivider;
