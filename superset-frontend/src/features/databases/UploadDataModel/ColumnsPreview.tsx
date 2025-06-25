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
import { FC } from 'react';
import { styled, t } from '@superset-ui/core';

import { Typography } from 'src/components';
import TagsList from 'src/components/Tags/TagsList';
import TagType from 'src/types/TagType';

interface ColumnsPreviewProps {
  columns: string[];
  maxColumnsToShow?: number;
}

export const StyledDivContainer = styled.div`
  //margin-top: 10px;
  //margin-bottom: 10px;
`;

const ColumnsPreview: FC<ColumnsPreviewProps> = ({
  columns,
  maxColumnsToShow = 4,
}) => {
  const tags: TagType[] = columns.map(column => ({ name: column }));

  return (
    <StyledDivContainer>
      <Typography.Text type="secondary">Columns:</Typography.Text>
      {columns.length === 0 ? (
        <p className="help-block">{t('Upload file to preview columns')}</p>
      ) : (
        <TagsList tags={tags} maxTags={maxColumnsToShow} />
      )}
    </StyledDivContainer>
  );
};

export default ColumnsPreview;
