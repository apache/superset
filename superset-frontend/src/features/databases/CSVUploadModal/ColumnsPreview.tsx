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
import React, { useState } from 'react';
import { styled, t } from '@superset-ui/core';

import { Typography } from 'src/components';
import { Tooltip } from 'src/components/Tooltip';
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';

interface ColumnsPreviewProps {
  columns: string[];
  maxColumnsToShow?: number;
}

export const StyledDivContainer = styled.div`
  margin-top: 10px;
  margin-bottom: 10px;
`;

const ColumnsPreview: React.FC<ColumnsPreviewProps> = ({
  columns,
  maxColumnsToShow = 4,
}) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  return (
    <StyledDivContainer>
      <Typography.Text type="secondary">Columns:</Typography.Text>
      {columns.length === 0 ? (
        <p className="help-block">{t('Upload CSV file to preview columns')}</p>
      ) : (
        <div>
          <Typography.Text type="secondary">
            Loaded {columns.length} column(s):
          </Typography.Text>
          {expanded ? (
            <>
              {columns.map((column, index) => (
                <Typography.Text key={index} code type="success">
                  {column}
                </Typography.Text>
              ))}
              {columns.length > maxColumnsToShow && (
                <Tooltip title={t('Collapse')}>
                  <ArrowLeftOutlined onClick={toggleExpand} type="secondary" />
                </Tooltip>
              )}
            </>
          ) : (
            <>
              {columns.slice(0, maxColumnsToShow).map((column, index) => (
                <Typography.Text key={index} code type="success">
                  {column}
                </Typography.Text>
              ))}
              {columns.length > maxColumnsToShow && (
                <Tooltip title={t('Display all')}>
                  <ArrowRightOutlined onClick={toggleExpand} type="secondary" />
                </Tooltip>
              )}
            </>
          )}
        </div>
      )}
    </StyledDivContainer>
  );
};

export default ColumnsPreview;
