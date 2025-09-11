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
import { Tag as AntdTag } from 'antd';
import { styled, useCSSTextTruncation } from '@superset-ui/core';
import { Tooltip } from '../Tooltip';
import { CustomCloseIcon } from '../Tags/Tag';
import { CustomTagProps } from './types';
import { SELECT_ALL_VALUE } from './utils';
import { NoElement } from './styles';

const StyledTag = styled(AntdTag)`
  & .ant-tag-close-icon {
    display: inline-flex;
    align-items: center;
    margin-left: ${({ theme }) => theme.gridUnit}px;
  }

  & .tag-content {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

// TODO: use antd Tag props instead of any. Currently it's causing a typescript error
const Tag = (props: any) => {
  const [tagRef, tagIsTruncated] = useCSSTextTruncation<HTMLSpanElement>();
  return (
    <Tooltip title={tagIsTruncated ? props.children : null}>
      <StyledTag
        closeIcon={props?.closable ? CustomCloseIcon : undefined}
        {...props}
        className="ant-select-selection-item"
      >
        <span className="tag-content" ref={tagRef}>
          {props.children}
        </span>
      </StyledTag>
    </Tooltip>
  );
};

/**
 * Custom tag renderer
 */
export const customTagRender = (props: CustomTagProps) => {
  const { label, value } = props;

  const onPreventMouseDown = (event: MouseEvent<HTMLElement>) => {
    // if close icon is clicked, stop propagation to avoid opening the dropdown
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'svg' ||
      target.tagName === 'path' ||
      (target.tagName === 'span' &&
        target.className.includes('ant-tag-close-icon'))
    ) {
      event.stopPropagation();
    }
  };

  if (value !== SELECT_ALL_VALUE) {
    return (
      <Tag onMouseDown={onPreventMouseDown} {...(props as object)}>
        {label}
      </Tag>
    );
  }
  return <NoElement />;
};
