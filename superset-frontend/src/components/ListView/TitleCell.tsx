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
import type { ReactNode } from 'react';
import { styled, css } from '@apache-superset/core/theme';

export interface ListViewTitleCellProps {
  /** Badges rendered before the title, e.g. certification or warnings. */
  leading?: ReactNode;
  /** The title link or text, truncated to a single line with an ellipsis. */
  children: ReactNode;
  /** Adornments rendered after the title, e.g. a tooltip or status tags. */
  trailing?: ReactNode;
}

const TITLE_CLASS_NAME = 'list-view-title';

// Inside a flex row the cell's own `text-overflow` no longer applies, so the
// title is the only shrinkable item and truncates itself; the adornments
// keep their natural size.
const Row = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;

    & > * {
      flex-shrink: 0;
    }

    & > .${TITLE_CLASS_NAME} {
      flex-shrink: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.2;
    }

    & > :not(.ant-tag) svg {
      margin-right: ${theme.sizeUnit}px;
    }

    & > .ant-tag {
      margin-left: ${theme.sizeUnit * 2}px;
    }
  `}
`;

/**
 * The standard content of a list view title column: optional leading
 * badges, the title, and optional trailing adornments on one line.
 */
export function ListViewTitleCell({
  leading,
  children,
  trailing,
}: ListViewTitleCellProps) {
  return (
    <Row>
      {leading}
      <span className={TITLE_CLASS_NAME}>{children}</span>
      {trailing}
    </Row>
  );
}
