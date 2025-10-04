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

import {
  t,
  css,
  styled,
  useTheme,
  useCSSTextTruncation,
} from '@superset-ui/core';
import { Tooltip } from '@superset-ui/core/components';
import { FilterBarOrientation } from 'src/dashboard/types';
import { Icons } from '@superset-ui/core/components/Icons';
import { ellipsisCss } from './styles';

const StyledCrossFilterTitle = styled.div`
  ${({ theme }) => `
    display: flex;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorText};
    vertical-align: middle;
    align-items: center;
  `}
`;

const StyledIconSearch = styled(Icons.SearchOutlined)`
  ${({ theme }) => `
    & > span.anticon.anticon-search {
      color: ${theme.colorIcon};
      margin-left: ${theme.sizeUnit}px;
      transition: 0.3s;
      vertical-align: middle;
      line-height: 0;
      &:hover {
        color: ${theme.colorIconHover};
      }
    }
  `}
`;

const CrossFilterChartTitle = (props: {
  title: string;
  orientation: FilterBarOrientation;
  onHighlightFilterSource: () => void;
}) => {
  const { title, orientation, onHighlightFilterSource } = props;
  const [titleRef, titleIsTruncated] = useCSSTextTruncation<HTMLSpanElement>();
  const theme = useTheme();
  return (
    <StyledCrossFilterTitle>
      <Tooltip title={titleIsTruncated ? title : null}>
        <span
          css={css`
            max-width: ${orientation === FilterBarOrientation.Vertical
              ? `${theme.sizeUnit * 45}px`
              : `${theme.sizeUnit * 15}px`};
            line-height: 1.4;
            ${ellipsisCss}
          `}
          ref={titleRef}
        >
          {title}
        </span>
      </Tooltip>
      <Tooltip title={t('Locate the chart')}>
        <StyledIconSearch
          iconSize="s"
          data-test="cross-filters-highlight-emitter"
          role="button"
          tabIndex={0}
          onClick={onHighlightFilterSource}
        />
      </Tooltip>
    </StyledCrossFilterTitle>
  );
};

export default CrossFilterChartTitle;
