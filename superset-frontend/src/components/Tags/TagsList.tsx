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

import React, { useMemo, useState } from 'react';
import { styled } from '@superset-ui/core';
import TagType from 'src/types/TagType';
import Tag from './Tag';

export type TagsListProps = {
  tags: TagType[];
  editable?: boolean;
  /**
   * OnDelete:
   * Only applies when editable is true
   * Callback for when a tag is deleted
   */
  onDelete?: ((index: number) => void) | undefined;
  maxTags?: number | undefined;
};

const TagsDiv = styled.div`
  max-width: 100%;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
`;

const TagsList = ({
  tags,
  editable = false,
  onDelete,
  maxTags,
}: TagsListProps) => {
  const [tempMaxTags, setTempMaxTags] = useState<number | undefined>(maxTags);

  const handleDelete = (index: number) => {
    onDelete?.(index);
  };

  const expand = () => setTempMaxTags(undefined);

  const collapse = () => setTempMaxTags(maxTags);

  const tagsIsLong: boolean | null = useMemo(
    () => (tempMaxTags ? tags.length > tempMaxTags : null),
    [tags.length, tempMaxTags],
  );

  const extraTags: number | null = useMemo(
    () =>
      typeof tempMaxTags === 'number' ? tags.length - tempMaxTags + 1 : null,
    [tagsIsLong, tags.length, tempMaxTags],
  );

  return (
    <TagsDiv className="tag-list">
      {tagsIsLong && typeof tempMaxTags === 'number' ? (
        <>
          {tags.slice(0, tempMaxTags - 1).map((tag: TagType, index) => (
            <Tag
              id={tag.id}
              key={tag.id}
              name={tag.name}
              index={index}
              onDelete={handleDelete}
              editable={editable}
            />
          ))}
          {tags.length > tempMaxTags ? (
            <Tag
              name={`+${extraTags}...`}
              onClick={expand}
              toolTipTitle={tags.map(t => t.name).join(', ')}
            />
          ) : null}
        </>
      ) : (
        <>
          {tags.map((tag: TagType, index) => (
            <Tag
              id={tag.id}
              key={tag.id}
              name={tag.name}
              index={index}
              onDelete={handleDelete}
              editable={editable}
            />
          ))}
          {maxTags ? (
            tags.length > maxTags ? (
              <Tag name="..." onClick={collapse} />
            ) : null
          ) : null}
        </>
      )}
    </TagsDiv>
  );
};

export default TagsList;
