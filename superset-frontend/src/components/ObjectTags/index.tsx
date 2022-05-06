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
import React, { useState, ChangeEvent, useEffect } from 'react';
import { t, css } from '@superset-ui/core';
import { useObjectTags } from 'src/views/CRUD/hooks';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import Tag from 'antd/lib/tag';
import { Input } from 'src/components/Input';
import { Tooltip } from 'src/components/Tooltip';
import { PlusOutlined } from '@ant-design/icons';

const ObjectTags = ({
  objectId,
  objectType,
}: {
  objectId: number;
  objectType: string;
}) => {
  const { state, fetchTags, deleteTag, addTag } = useObjectTags(
    { objectType, objectId },
    addDangerToast,
  );

  const stateTagNames = state.tags.map(
    (tag: { id: number; name: string }) => tag.name,
  );
  const [tagNames, setTagNames] = useState<string[]>([...stateTagNames]);
  const [tags, setTags] = useState<{ id: number; name: string }>();
  const [inputVisible, setInputVisible] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [editInputIndex, setEditInputIndex] = useState<number>(-1);
  const [editInputValue, setEditInputValue] = useState<string>('');

  useEffect(() => {
    fetchTags();
    setTags(state.tags);
  }, []);

  console.log('findme state', tagNames, tags);

  const tagNamesArray = [...stateTagNames, ...tagNames];

  const handleClose = (removedTag: string) => {
    setTagNames(tagNames.filter(tag => tag !== removedTag));
    deleteTag(removedTag);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputConfirm = () => {
    if (inputValue && tagNames.indexOf(inputValue) === -1) {
      const newTag = { id: objectId, name: inputValue };
      const newArr: string[] = [];
      // if (newArr !== tagNames) ;
      addTag(newTag);
      setTagNames([...tagNames, inputValue]);
      console.log('findme newtag', newTag, newArr, tagNames);
    }
    setInputVisible(false);
    setInputValue('');
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setEditInputValue(e.target.value);
  };

  const handleEditInputConfirm = () => {
    const newTagNames = [...tagNames];
    newTagNames[editInputIndex] = editInputValue;

    setTagNames(newTagNames);
    setEditInputIndex(-1);
    setEditInputValue('');
  };

  const inputStyles = (theme: any) => css`
    width: ${theme.gridUnit * 40}px;
    height: ${theme.gridUnit * 5.5}px;
  `;

  console.log('findme FINAL 1', tagNames);
  console.log('findme FINAL 2', state);

  // Object.entries(state?.tags).forEach(([key, value]) =>
  //   console.log(key, value),
  // );

  return (
    <>
      {tagNamesArray.map((tag: string, index: number) => {
        console.log('findme tagindex', tag, index);
        if (editInputIndex === index) {
          return (
            <Input
              key={tag}
              size="small"
              className="tag-input"
              value={editInputValue}
              onChange={handleEditInputChange}
              onBlur={handleEditInputConfirm}
              onPressEnter={handleEditInputConfirm}
              autoFocus
              css={inputStyles}
              placeholder={t('Edit tag...')}
            />
          );
        }

        const isLongTag = tag.length > 20;

        const tagElem = (
          <Tag
            className="edit-tag"
            key={tag}
            closable={index !== 0}
            onClose={() => handleClose(tag)}
          >
            <span
              onDoubleClick={e => {
                if (index !== 0) {
                  setEditInputIndex(index);
                  setEditInputValue(tag);
                  e.preventDefault();
                }
              }}
            >
              {isLongTag ? `${tag.slice(0, 20)}...` : tag}
            </span>
          </Tag>
        );
        return isLongTag ? (
          <Tooltip title={tag} key={tag}>
            {tagElem}
          </Tooltip>
        ) : (
          tagElem
        );
      })}
      {inputVisible && (
        <Input
          type="text"
          size="small"
          className="tag-input"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputConfirm}
          onPressEnter={handleInputConfirm}
          autoFocus
          css={inputStyles}
          placeholder={t('New tag...')}
        />
      )}
      {!inputVisible && (
        <Tag className="site-tag-plus" onClick={() => setInputVisible(true)}>
          <PlusOutlined /> {t('New Tag')}
        </Tag>
      )}
    </>
  );
};

export default ObjectTags;
