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

import React, { useState } from 'react';
import { styled, SupersetTheme, t } from '@superset-ui/core';
import Tag from './Tag';
import TagType from 'src/types/TagType';
import Icons from '../Icons';

export type TagsListProps = {
  tags: TagType[];
  editable?: boolean;
  onDelete: (index: number) => void;
};

const TagsDiv = styled.div`
  max-width: 100%;
  display: -webkit-flex;
  display: flex;
  -webkit-flex-direction: row;
  -webkit-flex-wrap: wrap;
`;

const EditButton = ({
  onClick,
} : any ) => {
  return (
    <div
      role="button"
      className="action-button"
      onClick={onClick}
      data-test="dashboard-card-option-edit-button"
    >
      <Icons.EditAlt iconSize="l" data-test="edit-alt" />
    </div>
  );
}
const TagsList = ({ 
  tags, 
  editable=false, 
  onDelete=(index) => null, 
}: TagsListProps) => {

  const handleDelete = (index: number) => {
    onDelete(index);
  }
  return (
    <TagsDiv>
      {tags.map((tag: TagType, index) => (
        <Tag id={tag.id} name={tag.name} index={index} onDelete={handleDelete} editable={editable}/>
      ))}
    </TagsDiv>
  );
};

export default TagsList;
