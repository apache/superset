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
import { t } from '@apache-superset/core/translation';
import { Flex, Typography } from '@superset-ui/core/components';
import { TreeTableColumn, TreeLevel } from './types';

export interface DetailBlockProps {
  level: TreeLevel;
  row: Record<string, unknown>;
  columns: TreeTableColumn[];
}

/** A labelled group of detail fields with labels above their values. */
export default function DetailBlock({ level, row, columns }: DetailBlockProps) {
  const title = t('%s details', level.name);
  return (
    <Flex
      vertical
      gap="small"
      // A fieldset brings form semantics and default browser styling.
      // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="group"
      aria-label={title}
    >
      <div className="tree-table-detail-fields">
        {columns.map(column => (
          <Flex vertical key={column.key}>
            <Typography.Text
              className="tree-table-detail-label"
              ellipsis
              title={column.label}
            >
              {column.label}
            </Typography.Text>
            <Typography.Text>
              {column.formatter?.(row[column.key]) ?? String(row[column.key])}
            </Typography.Text>
          </Flex>
        ))}
      </div>
    </Flex>
  );
}
