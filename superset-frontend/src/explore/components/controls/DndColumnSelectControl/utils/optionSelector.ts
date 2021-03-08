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
  values: ColumnMeta[];

  options: { string: ColumnMeta };

  isArray: boolean;

  constructor(
    options: { string: ColumnMeta },
    initialValues?: string[] | string,
  ) {
    this.options = options;
    let values: string[];
    if (Array.isArray(initialValues)) {
      values = initialValues;
      this.isArray = true;
    } else {
      values = initialValues ? [initialValues] : [];
      this.isArray = false;
    }
    this.values = values
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
      this.values.push(this.options[value]);
    }
  }

  del(idx: number) {
    this.values.splice(idx, 1);
  }

  replace(idx: number, value: string) {
    if (this.values[idx]) {
      this.values[idx] = this.options[value];
    }
  }

  swap(a: number, b: number) {
    [this.values[a], this.values[b]] = [this.values[b], this.values[a]];
  }

  has(groupBy: string): boolean {
    return !!this.getValues()?.includes(groupBy);
  }

  getValues(): string[] | string | undefined {
    if (!this.isArray) {
      return this.values.length > 0 ? this.values[0].column_name : undefined;
    }
    return this.values.map(option => option.column_name);
  }
}
