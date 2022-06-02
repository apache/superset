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
import { styled, SupersetTheme } from '@superset-ui/core';
import AntdTag from 'antd/lib/tag';
import Tag from 'src/types/Tag';

export type TagsListProps = {
  tags: Tag[];
};

const customTagStyler = (theme: SupersetTheme) => `
  margin-top: ${theme.gridUnit * 1}px;
  margin-bottom: ${theme.gridUnit * 1}px;
  font-size: ${theme.typography.sizes.s}px;
`;

const StyledTag = styled(AntdTag)`
  ${({ theme }) => customTagStyler(theme)}
`;

const TagsDiv = styled.div`
  max-width: 100%;
  display: -webkit-flex;
  display: flex;
  -webkit-flex-direction: row;
  -webkit-flex-wrap: wrap;
`;

export const TagsList = ({ tags }: TagsListProps) => (
  <TagsDiv>
    {tags.map((tag: Tag) => (
      <StyledTag>
        <a href={`/superset/tags/?tags=${tag.name}`}>{tag.name}</a>
      </StyledTag>
    ))}
  </TagsDiv>
);
