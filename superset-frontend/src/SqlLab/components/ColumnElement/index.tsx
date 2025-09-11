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
import { ReactNode } from 'react';
import { ClassNames } from '@emotion/react';
import { styled, useTheme, t } from '@superset-ui/core';
import { Tooltip } from 'src/components/Tooltip';

const StyledTooltip = (props: any) => {
  const theme = useTheme();
  return (
    <ClassNames>
      {({ css }) => (
        <Tooltip
          overlayClassName={css`
            .ant-tooltip-inner {
              max-width: ${theme.gridUnit * 125}px;
              word-wrap: break-word;
              text-align: center;

              pre {
                background: transparent;
                border: none;
                text-align: left;
                color: ${theme.colors.grayscale.light5};
                font-size: ${theme.typography.sizes.xs}px;
              }
            }
          `}
          {...props}
        />
      )}
    </ClassNames>
  );
};

const Hr = styled.hr`
  margin-top: ${({ theme }) => theme.gridUnit * 1.5}px;
`;

const iconMap = {
  pk: 'fa-key',
  fk: 'fa-link',
  index: 'fa-bookmark',
};

const tooltipTitleMap = {
  pk: t('Primary key'),
  fk: t('Foreign key'),
  index: t('Index'),
};

export type ColumnKeyTypeType = keyof typeof tooltipTitleMap;

interface ColumnElementProps {
  column: {
    name: string;
    keys?: { type: ColumnKeyTypeType }[];
    type: string;
  };
}

const NowrapDiv = styled.div`
  white-space: nowrap;
`;

const ColumnElement = ({ column }: ColumnElementProps) => {
  let columnName: ReactNode = column.name;
  let icons;
  if (column.keys && column.keys.length > 0) {
    columnName = <strong>{column.name}</strong>;
    icons = column.keys.map((key, i) => (
      <span key={i} className="ColumnElement">
        <StyledTooltip
          placement="right"
          title={
            <>
              <strong>{tooltipTitleMap[key.type]}</strong>
              <Hr />
              <pre className="text-small">
                {JSON.stringify(key, null, '  ')}
              </pre>
            </>
          }
        >
          <i className={`fa text-muted m-l-2 ${iconMap[key.type]}`} />
        </StyledTooltip>
      </span>
    ));
  }
  return (
    <div className="clearfix table-column">
      <div className="pull-left m-l-10 col-name">
        {columnName}
        {icons}
      </div>
      <NowrapDiv className="pull-right text-muted">
        <small> {column.type}</small>
      </NowrapDiv>
    </div>
  );
};

export default ColumnElement;
