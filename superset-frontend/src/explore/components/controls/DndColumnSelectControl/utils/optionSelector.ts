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
import { ColumnMeta } from '@superset-ui/chart-controls';

export class OptionSelector {
  groupByOptions: ColumnMeta[];

  options: { string: ColumnMeta };

  isArray: boolean;

  constructor(
    options: { string: ColumnMeta },
    values: string[] | string | null,
  ) {
    this.options = options;
    let groupByValues: string[];
    if (Array.isArray(values)) {
      groupByValues = values;
      this.isArray = true;
    } else {
      groupByValues = values ? [values] : [];
      this.isArray = false;
    }
    this.groupByOptions = groupByValues
      .map(value => {
        if (value in options) {
          return options[value];
        }
        return null;
      })
      .filter(Boolean);
  }

  add(value: string) {
    if (value in this.options) {
      this.groupByOptions.push(this.options[value]);
    }
  }

  del(idx: number) {
    this.groupByOptions.splice(idx, 1);
  }

  replace(idx: number, value: string) {
    if (this.groupByOptions[idx]) {
      this.groupByOptions[idx] = this.options[value];
    }
  }

  swap(a: number, b: number) {
    [this.groupByOptions[a], this.groupByOptions[b]] = [
      this.groupByOptions[b],
      this.groupByOptions[a],
    ];
  }

  has(groupBy: string): boolean {
    return !!this.getValues()?.includes(groupBy);
  }

  getValues(): string[] | string | null {
    if (!this.isArray) {
      return this.groupByOptions.length > 0
        ? this.groupByOptions[0].column_name
        : null;
    }
    return this.groupByOptions.map(option => option.column_name);
  }
}
