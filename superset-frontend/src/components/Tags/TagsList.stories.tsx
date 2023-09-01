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
import TagType from 'src/types/TagType';
import { TagsList } from '.';
import { TagsListProps } from './TagsList';

export default {
  title: 'Tags',
  component: TagsList,
};

export const InteractiveTags = ({ tags, editable, maxTags }: TagsListProps) => (
  <TagsList tags={tags} editable={editable} maxTags={maxTags} />
);

const tags: TagType[] = [
  { name: 'tag1' },
  { name: 'tag2' },
  { name: 'tag3' },
  { name: 'tag4' },
  { name: 'tag5' },
  { name: 'tag6' },
];

const editable = true;

const maxTags = 3;

InteractiveTags.args = {
  tags,
  editable,
  maxTags,
};

InteractiveTags.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};
