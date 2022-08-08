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

import React, { Dispatch, SetStateAction, useState } from 'react';
import { SelectValue as AntdSelectValue } from 'antd/lib/select';
import classNames from 'classnames';
import { CloseOutlined } from '@ant-design/icons';
import { ensureIsArray } from '@superset-ui/core';
import { Input } from '../Input';
import { OptionsType } from './Select';
import { isLabeledValue } from './utils';

export type CustomTagProps = {
  label: React.ReactNode;
  value: any;
  disabled: boolean;
  onClose: (event?: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  closable: boolean;
};

export interface EditableTagProps extends CustomTagProps {
  selectValue: AntdSelectValue | undefined;
  setSelectValue: Dispatch<SetStateAction<AntdSelectValue | undefined>>;
  selectOptions?: OptionsType;
  onChange?: (value: any, option: any) => void;
}

const EditableTag = (props: EditableTagProps) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(props.value);

  const updateValue = () => {
    setEditing(false);
    const array = ensureIsArray(props.selectValue);

    // eslint-disable-next-line eqeqeq -- Non-strict comparison is intentional here because types could be different.
    const existingOption = props.selectOptions?.find(e => e.value == value);

    const v: string[] = array
      .map(e => {
        if (e === props.value) {
          // If this one we want to replace, use the value of the existing option if it exists
          if (existingOption) {
            return existingOption.value;
          }
          if (isLabeledValue(props.value)) {
            return { key: value, value, label: String(value) };
          }
          return value;
        }
        return e;
      })
      .filter(e => e !== '' && e !== null);

    props.setSelectValue(v);
    if (props.onChange) {
      props.onChange(v, existingOption ?? { value: v, label: String(v) });
    }
  };

  // Sometimes an empty tag will appear for some reason if this is not included.
  if (!props.value || props.value === '') {
    return null;
  }

  const selectionPrefixCls = 'ant-select-selection';

  return (
    <span
      className={classNames(`${selectionPrefixCls}-item`, {
        [`${selectionPrefixCls}-item-disabled`]: props.disabled,
      })}
      onDoubleClick={() => {
        setEditing(true);
      }}
    >
      <span className={`${selectionPrefixCls}-item-content`}>
        {editing ? (
          <Input
            style={{ width: '95%', lineHeight: 'normal', padding: '0' }}
            autoFocus
            onBlur={event => updateValue()}
            onKeyDown={event => {
              if (event.key === 'Backspace') {
                event.stopPropagation();
              } else if (event.key === 'Enter') {
                updateValue();
                event.stopPropagation();
              }
            }}
            value={value}
            onChange={event => setValue(event.target.value)}
          />
        ) : (
          props.label
        )}
      </span>
      {props.closable && (
        <span
          className={`${selectionPrefixCls}-item-remove`}
          onMouseDown={(e: any) => e.preventDefault()}
          onClick={props.onClose}
        >
          <CloseOutlined />
        </span>
      )}
    </span>
  );
};

export default EditableTag;
