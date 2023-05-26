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

const Tag = ({
  name,
  id,
  index = undefined,
  onDelete = undefined,
  editable = false,
  onClick = undefined,
}: TagType) => {
  const isLongTag = useMemo(() => name.length > 20, [name]);

  const handleClose = () => (index ? onDelete?.(index) : null);

  const tagElem = (
    <>
      {editable ? (
        <StyledTag
          key={id}
          closable={editable}
          onClose={handleClose}
          color="blue"
        >
          {isLongTag ? `${name.slice(0, 20)}...` : name}
        </StyledTag>
      ) : (
        <StyledTag role="link" key={id} onClick={onClick}>
          {id ? (
            <a
              href={`/superset/all_entities/?tags=${name}`}
              target="_blank"
              rel="noreferrer"
            >
              {isLongTag ? `${name.slice(0, 20)}...` : name}
            </a>
          ) : isLongTag ? (
            `${name.slice(0, 20)}...`
          ) : (
            name
          )}
        </StyledTag>
      )}
    </>
  );

  return isLongTag ? (
    <Tooltip title={name} key={name}>
      {tagElem}
    </Tooltip>
  ) : (
    tagElem
  );
};

export default Tag;
