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
import React from 'react';
import { ensureIsArray, styled, t } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { ContentType, MetadataType } from '.';

const Header = styled.div`
  font-weight: ${({ theme }) => theme.typography.weights.bold};
`;

const Info = ({
  text,
  header,
}: {
  text?: string | string[];
  header?: string;
}) => {
  const values = ensureIsArray(text);
  return (
    <>
      {header && <Header>{header}</Header>}
      {values.map(value => (
        <div key={value}>{value}</div>
      ))}
    </>
  );
};

const config = (contentType: ContentType) => {
  const { type } = contentType;

  /**
   * Tooltips are very similar. It's pretty much blocks
   * of header/text pairs. That's why they are implemented here.
   * If more complex tooltips emerge, then we should extract the different
   * types of tooltips to their own components and reference them here.
   */

  switch (type) {
    case MetadataType.DASHBOARDS:
      return {
        icon: Icons.FundProjectionScreenOutlined,
        title: contentType.title,
        tooltip: contentType.description ? (
          <div>
            <Info header={contentType.title} text={contentType.description} />
          </div>
        ) : undefined,
      };

    case MetadataType.DESCRIPTION:
      return {
        icon: Icons.BookOutlined,
        title: contentType.value,
      };

    case MetadataType.LAST_MODIFIED:
      return {
        icon: Icons.EditOutlined,
        title: contentType.value,
        tooltip: (
          <div>
            <Info header={t('Last modified')} text={contentType.value} />
            <Info header={t('Modified by')} text={contentType.modifiedBy} />
          </div>
        ),
      };

    case MetadataType.OWNER:
      return {
        icon: Icons.UserOutlined,
        title: contentType.createdBy,
        tooltip: (
          <div>
            <Info header={t('Created by')} text={contentType.createdBy} />
            {!!contentType.owners && (
              <Info header={t('Owners')} text={contentType.owners} />
            )}
            <Info header={t('Created on')} text={contentType.createdOn} />
          </div>
        ),
      };

    case MetadataType.ROWS:
      return {
        icon: Icons.InsertRowBelowOutlined,
        title: contentType.title,
        tooltip: contentType.title,
      };

    case MetadataType.SQL:
      return {
        icon: Icons.ConsoleSqlOutlined,
        title: contentType.title,
        tooltip: contentType.title,
      };

    case MetadataType.TABLE:
      return {
        icon: Icons.Table,
        title: contentType.title,
        tooltip: contentType.title,
      };

    case MetadataType.TAGS:
      return {
        icon: Icons.TagsOutlined,
        title: contentType.values.join(', '),
        tooltip: (
          <div>
            <Info header={t('Tags')} text={contentType.values} />
          </div>
        ),
      };

    default:
      throw Error(`Invalid type provided: ${type}`);
  }
};

export { config };
