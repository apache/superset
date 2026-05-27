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

import { useCSSTextTruncation } from '@superset-ui/core';
import { styled, css, useTheme } from '@apache-superset/core/theme';
import { Tag } from 'src/components/Tag';
import { Tooltip } from '@superset-ui/core/components';
import { FilterBarOrientation } from 'src/dashboard/types';
import { ellipsisCss } from '../CrossFilters/styles';
import { UrlFilterIndicator } from './urlFilterUtils';

const StyledValue = styled.b`
  ${({ theme }) => `
    max-width: ${theme.sizeUnit * 25}px;
  `}
  ${ellipsisCss}
`;

const StyledColumn = styled('span')`
  ${({ theme }) => `
    max-width: ${theme.sizeUnit * 25}px;
    padding-right: ${theme.sizeUnit}px;
  `}
  ${ellipsisCss}
`;

const StyledTag = styled(Tag)`
  ${({ theme }) => `
    border: 1px solid ${theme.colorBorder};
    border-radius: 2px;
    .anticon-close {
      vertical-align: middle;
    }
  `}
`;

const UrlFilterTag = (props: {
  filter: UrlFilterIndicator;
  orientation: FilterBarOrientation;
  onRemove: (filter: UrlFilterIndicator) => void;
}) => {
  const { filter, orientation, onRemove } = props;
  const theme = useTheme();
  const [columnRef, columnIsTruncated] =
    useCSSTextTruncation<HTMLSpanElement>();
  const [valueRef, valueIsTruncated] = useCSSTextTruncation<HTMLSpanElement>();

  return (
    <StyledTag
      css={css`
        ${orientation === FilterBarOrientation.Vertical
          ? `margin-top: ${theme.sizeUnit * 2}px;`
          : `margin-left: ${theme.sizeUnit * 2}px;`}
      `}
      closable
      onClose={() => onRemove(filter)}
    >
      <Tooltip title={columnIsTruncated ? filter.subject : null}>
        <StyledColumn ref={columnRef}>{filter.subject}</StyledColumn>
      </Tooltip>
      <Tooltip title={valueIsTruncated ? filter.value : null}>
        <StyledValue ref={valueRef}>{filter.value}</StyledValue>
      </Tooltip>
    </StyledTag>
  );
};

export default UrlFilterTag;
