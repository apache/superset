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

import { styled } from '@superset-ui/core';
import { Link } from 'react-router-dom';
import TagType from 'src/types/TagType';
import { Tag as AntdTag } from '@superset-ui/core/components/Tag';
import { Tooltip } from '@superset-ui/core/components/Tooltip';
import type { TagProps } from 'antd/es';
import type { CheckableTagProps } from 'antd/es/tag';
import { useMemo } from 'react';

const StyledTag = styled(AntdTag)`
  ${({ theme }) => `
  margin-top: ${theme.sizeUnit}px;
  margin-bottom: ${theme.sizeUnit}px;
  `};
`;

const MAX_DISPLAY_CHAR = 20;

const SupersetTag = ({
  name,
  id,
  index = undefined,
  onDelete = undefined,
  editable = false,
  onClick = undefined,
  toolTipTitle = name,
  children,
  ...rest
}: TagType) => {
  const tagDisplay = useMemo(() => {
    if (!name) return null;
    const isLongTag = name.length > MAX_DISPLAY_CHAR;
    return isLongTag ? `${name.slice(0, MAX_DISPLAY_CHAR)}...` : name;
  }, [name]);

  const handleClose = () => (index !== undefined ? onDelete?.(index) : null);

  const whatRole = onClick ? (!id ? 'button' : 'link') : undefined;

  const tagElem = (
    <>
      {editable ? (
        <Tooltip title={toolTipTitle} key={toolTipTitle}>
          <StyledTag
            key={id}
            closable={editable}
            onClose={handleClose}
            closeIcon={editable}
            {...rest}
          >
            {children || tagDisplay}
          </StyledTag>
        </Tooltip>
      ) : (
        <Tooltip title={toolTipTitle} key={toolTipTitle}>
          <StyledTag
            data-test="tag"
            key={id}
            onClick={onClick}
            role={whatRole}
            {...rest}
          >
            {' '}
            {id ? (
              <Link
                to={`/superset/all_entities/?id=${id}`}
                target="_blank"
                rel="noreferrer"
              >
                {children || tagDisplay}
              </Link>
            ) : (
              children || tagDisplay
            )}
          </StyledTag>
        </Tooltip>
      )}
    </>
  );

  return tagElem;
};

export const Tag = Object.assign(SupersetTag, {
  CheckableTag: AntdTag.CheckableTag,
});
export type { TagProps, CheckableTagProps, TagType };
