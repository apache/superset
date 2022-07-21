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

import React, { useCallback, useEffect, useState } from 'react';
import { styled, SupersetClient, t, useTheme } from '@superset-ui/core';
import Tag from 'src/types/TagType';

import './ObjectTags.css';
import { TagsList } from 'src/components/Tags';
import Icons from '../Icons';
import AsyncSelect from '../Select/AsyncSelect';
import rison from 'rison';
import { cacheWrapper } from 'src/utils/cacheWrapper';
import { ClientErrorObject, getClientErrorObject } from 'src/utils/getClientErrorObject';
import { SelectValue } from 'antd/lib/select';
import { addTag, deleteTag, fetchSuggestions, fetchTags } from 'src/tags';
import { StyledModal } from 'src/components/Modal';

interface ObjectTagsProps {
  objectType: string;
  objectId: number;
  includeTypes: boolean;
  editMode: boolean;
  maxTags: number | null;
  onChange?: (tags: Tag[]) => void;
}

interface SelectTagsProps {
  onSelectTag: (tag: Tag) => void;
}

const StyledTagsDiv = styled.div`
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  max-width: 100%;
  display: -webkit-flex;
  display: flex;
  -webkit-flex-direction: row;
  -webkit-flex-wrap: wrap;
  `

const StyledTagsDropdown = styled.div`
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  max-width: 100%;
  display: -webkit-flex;
  display: flex;
  -webkit-flex-direction: row;
  -webkit-flex-wrap: wrap;
  backgroundColor: ${({ theme }) => theme.colors.grayscale.light4};
  `

const AddTags = styled.div`
  max-width: 100%;
  display: -webkit-flex;
  display: flex;
  -webkit-flex-direction: row;
`;

const localCache = new Map<string, any>();

const cachedSupersetGet = cacheWrapper(
  SupersetClient.get,
  localCache,
  ({ endpoint }) => endpoint || '',
);

type SelectTagsValue = {
  value: string | number | undefined;
  label: string;
};

export const tagToSelectOption = (
  item: Tag & { table_name: string },
): SelectTagsValue => ({
  value: item.id,
  label: item.name,
});

export const loadTags = async (
  search: string,
  page: number,
  pageSize: number,
) => {
  const searchColumn = 'name';
  const query = rison.encode({
    filters: [{ col: searchColumn, opr: 'ct', value: search }],
    page,
    page_size: pageSize,
    order_column: searchColumn,
    order_direction: 'asc',
  });
  
  const getErrorMessage = ({ error, message }: ClientErrorObject) => {
      let errorText = message || error || t('An error has occurred');
      if (message === 'Forbidden') {
        errorText = t('You do not have permission to edit this dashboard');
      }
      return errorText;
  }
  
  return cachedSupersetGet({
    endpoint: `/api/v1/tag/?q=${query}`,
    // endpoint: `/api/v1/tags/?q=${query}`,
  })
    .then(response => {
      const data: {
        label: string;
        value: string | number;
      }[] = response.json.result.map(tagToSelectOption);
      return {
        data,
        totalCount: response.json.count,
      };
    })
    .catch(async error => {
      const errorMessage = getErrorMessage(await getClientErrorObject(error));
      throw new Error(errorMessage);
    });
};

const SelectTags = ({
  onSelectTag,
}: SelectTagsProps) => {

  const [selectValue, setSelectValue] = useState<SelectValue>();

  
  const onSelect = (value: { label: string; value: number }) => {
    onSelectTag({name: value.label});
    setSelectValue('');
  };

  const selectProps = {
    allowClear: true,
    allowNewOptions: true,
    ariaLabel: 'Tags',
    labelInValue: true,
    options: loadTags,
    pageSize: 10,
    showSearch: true,
  };
  return (<AsyncSelect {...selectProps} onChange={onSelect} value={selectValue}/>);
};


const EditTagsButton = ({
  onClick,
  visible=true,
} : any ) => {
  if(!visible) {return null}
  const styling = {
    verticalAlign: '-webkit-baseline-middle'
  }
  return (
    <div
      role="button"
      className="action-button"
      onClick={onClick}
      data-test="dashboard-tags-edit-button"
    >
      <Icons.EditAlt iconSize="l" data-test="edit-alt" style={styling}/>
    </div>
  );
}

const SaveButton = ({
  onClick,
} : any ) => {
  const styling = {
    verticalAlign: '-webkit-baseline-middle',
    marginLeft:  `inherit`
  }
  return (
    <div
      role="button"
      className="action-button"
      onClick={onClick}
      data-test="dashboard-tags-check-button"
    >
      <Icons.CheckCircleOutlined iconSize="l" style={styling} />
    </div>
  );
}

export const ObjectTags = ({
  objectType,
  objectId,
  includeTypes,
  editMode=false,
  maxTags=null,
  onChange,
}: ObjectTagsProps) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);

  useEffect(() => {
    try {
      fetchTags(
        {objectType, objectId, includeTypes},
        (tags: Tag[]) => setTags(tags),
        () => {/*TODO: handle error*/});
    } catch(error: any) {
      console.log(error)
    }
  }, [objectType, objectId, includeTypes]);

  const theme = useTheme();

  const TagsDiv = ({
    ...props
  }: any ) => {
    if(showTagsDropdown){
      return (
        <StyledTagsDropdown 
        {...props} css={{backgroundColor: theme.colors.grayscale.light4}}/>
      );
    }
    return (<StyledTagsDiv {...props}/>)
  };

  const onDelete = (tagIndex: number) => {
    deleteTag(
      {objectType, objectId},
      tags[tagIndex], 
      () => setTags(tags.filter((_, i) => i !== tagIndex)),
      () => {/* TODO: handle error */}
    );
    onChange?.(tags);
  };

  const onAddition = (tag: Tag) => {
    if (tags.some(t => t.name === tag.name)) {
      return;
    }
    addTag(
      {objectType, objectId, includeTypes},
      tag.name, 
      () => setTags([...tags, tag]),
      () => {/* TODO: handle error */}
    );
    onChange?.(tags);
  };

  const handleMouseOver = () => {
    setShowTagsDropdown(true);
  }
  
  const handleMouseLeave = () => {
    setShowTagsDropdown(false);
  }

  return (
    <span>
      <TagsDiv onMouseOver={handleMouseOver} onMouseLeave={handleMouseLeave}>
        <TagsList tags={tags} editable={editMode} onDelete={onDelete} maxTags={maxTags}/>
      </TagsDiv>
    </span>
  );
};

export default ObjectTags;
