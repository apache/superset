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
import { ColumnMeta, isColumnMeta } from '@superset-ui/chart-controls';
import {
  AdhocColumn,
  ensureIsArray,
  QueryFormColumn,
  isPhysicalColumn,
  t,
} from '@superset-ui/core';

const getColumnNameOrAdhocColumn = (
  column: ColumnMeta | AdhocColumn,
): QueryFormColumn => {
  if (isColumnMeta(column)) {
    return column.column_name;
  }
  return column as AdhocColumn;
};

export class OptionSelector {
  values: (ColumnMeta | AdhocColumn)[];

  options: Record<string, ColumnMeta>;

  multi: boolean;

  constructor(
    options: Record<string, ColumnMeta>,
    multi: boolean,
    initialValues?: QueryFormColumn[] | QueryFormColumn | null,
  ) {
    this.options = options;
    this.multi = multi;
    this.values = ensureIsArray(initialValues)
      .map(value => {
        if (value && isPhysicalColumn(value) && value in options) {
          return options[value];
        }
        if (!isPhysicalColumn(value)) {
          return value;
        }
        return {
          type_generic: 'UNKNOWN',
          column_name: value,
          error_text: t(
            'This column might be incompatible with current dataset',
          ),
        };
      })
      .filter(Boolean) as ColumnMeta[];
  }

  add(value: QueryFormColumn) {
    if (isPhysicalColumn(value) && value in this.options) {
      this.values.push(this.options[value]);
    } else if (!isPhysicalColumn(value)) {
      this.values.push(value as AdhocColumn);
    }
  }

  del(idx: number) {
    this.values.splice(idx, 1);
  }

  replace(idx: number, value: QueryFormColumn) {
    if (this.values[idx]) {
      this.values[idx] = isPhysicalColumn(value) ? this.options[value] : value;
    }
  }

  swap(a: number, b: number) {
    [this.values[a], this.values[b]] = [this.values[b], this.values[a]];
  }

  has(value: QueryFormColumn): boolean {
    return this.values.some(col => {
      if (isPhysicalColumn(value)) {
        return (
          (col as ColumnMeta).column_name === value ||
          (col as AdhocColumn).label === value
        );
      }
      return (
        (col as ColumnMeta).column_name === value.label ||
        (col as AdhocColumn).label === value.label
      );
    });
  }

  getValues(): QueryFormColumn[] | QueryFormColumn | undefined {
    if (!this.multi) {
      return this.values.length > 0
        ? getColumnNameOrAdhocColumn(this.values[0])
        : undefined;
    }
    return this.values.map(getColumnNameOrAdhocColumn);
  }
}
