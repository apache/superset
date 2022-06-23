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

import React, { useEffect, useState } from 'react';
import ReactTags from 'react-tag-autocomplete';
import { t, styled } from '@superset-ui/core';
import { TagsList } from 'src/components/TagsList';
import AntdTag from 'antd/lib/tag';
import Tag from 'src/types/Tag';

import './ObjectTags.css';

interface TagComponentProps {
  tag: Tag;
  onDelete: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

interface ObjectTagsProps {
  fetchTags: (callback: (tags: Tag[]) => void) => void;
  fetchSuggestions: (callback: (suggestions: Tag[]) => void) => void;
  deleteTag: (tag: string, callback: () => void) => void;
  addTag: (tag: string, callback: () => void) => void;
  editable: boolean;
  onChange?: (tags: Tag[]) => void;
}

const TagsDiv = styled.div`
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
`;

const TagComponent = ({ tag, onDelete }: TagComponentProps) => (
  <AntdTag key={tag.id} closable onClose={onDelete} color="blue">
    {tag.name}
  </AntdTag>
);

export const ObjectTags = ({
  fetchTags,
  fetchSuggestions,
  deleteTag,
  addTag,
  editable,
  onChange,
}: ObjectTagsProps) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<Tag[]>([]);

  const filterSuggestions = () => {
    setFilteredSuggestions(
      [...tagSuggestions].filter(suggestion =>
        tags.every(tag => tag.name !== suggestion.name),
      ),
    );
  };

  useEffect(() => {
    fetchTags((tags: Tag[]) => {
      setTags(tags);
    });
    fetchSuggestions((suggestions: Tag[]) => {
      setTagSuggestions(suggestions);
    });
  }, []);

  useEffect(() => {
    if (tagSuggestions.length !== 0) {
      filterSuggestions();
    }
  }, [tags, tagSuggestions]);

  const onDelete = (tagIndex: number) => {
    deleteTag(tags[tagIndex].name, () =>
      setTags(tags.filter((_, i) => i !== tagIndex)),
    );
    onChange?.(tags);
  };

  const onAddition = (tag: Tag) => {
    if (tags.some(t => t.name === tag.name)) {
      return;
    }
    addTag(tag.name, () => setTags([...tags, tag]));
    onChange?.(tags);
  };

  if (editable) {
    return (
      <ReactTags
        tags={tags}
        suggestions={filteredSuggestions}
        onDelete={onDelete}
        onAddition={onAddition}
        placeholderText={t('Add tag')}
        tagComponent={TagComponent}
        allowBackspace={false}
        allowNew
      />
    );
  }

  return (
    <TagsDiv>
      <TagsList tags={tags} />
    </TagsDiv>
  );
};

export default ObjectTags;
