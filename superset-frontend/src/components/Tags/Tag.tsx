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
import TagType from 'src/types/TagType';
import AntdTag from 'antd/lib/tag';
import React, { useMemo } from 'react';
import { Tooltip } from 'src/components/Tooltip';

const StyledTag = styled(AntdTag)`
  ${({ theme }) => `
  margin-top: ${theme.gridUnit}px;
  margin-bottom: ${theme.gridUnit}px;
  font-size: ${theme.typography.sizes.s}px;
  `};
`;

const MAX_DISPLAY_CHAR = 20;

const Tag = ({
  name,
  id,
  index = undefined,
  onDelete = undefined,
  editable = false,
  onClick = undefined,
  toolTipTitle = name,
}: TagType) => {
  const isLongTag = useMemo(() => name.length > MAX_DISPLAY_CHAR, [name]);
  const tagDisplay = isLongTag ? `${name.slice(0, MAX_DISPLAY_CHAR)}...` : name;

  const handleClose = () => (index ? onDelete?.(index) : null);

  const tagElem = (
    <>
      {editable ? (
        <Tooltip title={toolTipTitle} key={toolTipTitle}>
          <StyledTag
            key={id}
            closable={editable}
            onClose={handleClose}
            color="blue"
          >
            {tagDisplay}
          </StyledTag>
        </Tooltip>
      ) : (
        <Tooltip title={toolTipTitle} key={toolTipTitle}>
          <StyledTag data-test="tag" role="link" key={id} onClick={onClick}>
            {id ? (
              <a
                href={`/superset/all_entities/?id=${id}`}
                target="_blank"
                rel="noreferrer"
              >
                {tagDisplay}
              </a>
            ) : (
              tagDisplay
            )}
          </StyledTag>
        </Tooltip>
      )}
    </>
  );

  return tagElem;
};

export default Tag;
