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
import { MouseEvent } from 'react';
import { Tag } from '../Tag';
import { CustomTagProps } from './types';

/**
 * Custom tag renderer
 */
export const customTagRender = (props: CustomTagProps) => {
  const { label } = props;

  const onPreventMouseDown = (event: MouseEvent<HTMLElement>) => {
    // if close icon is clicked, stop propagation to avoid opening the dropdown
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'svg' ||
      target.tagName === 'path' ||
      (target.tagName === 'span' &&
        target.className.includes('antd5-tag-close-icon'))
    ) {
      event.stopPropagation();
    }
  };

  return (
    <Tag
      onMouseDown={onPreventMouseDown}
      name={label}
      className="antd5-select-selection-item"
      {...(props as object)}
    >
      {label}
    </Tag>
  );
};
