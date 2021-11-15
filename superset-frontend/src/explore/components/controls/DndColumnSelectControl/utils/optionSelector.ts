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
import { ensureIsArray } from '@superset-ui/core';

export class OptionSelector {
  values: ColumnMeta[];

  options: Record<string, ColumnMeta>;

  multi: boolean;

  constructor(
    options: Record<string, ColumnMeta>,
    multi: boolean,
    initialValues?: string[] | string | null,
  ) {
    this.options = options;
    this.multi = multi;
    this.values = ensureIsArray(initialValues)
      .map(value => {
        if (value && value in options) {
          return options[value];
        }
        return null;
      })
      .filter(Boolean) as ColumnMeta[];
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

  has(value: string): boolean {
    return ensureIsArray(this.getValues()).includes(value);
  }

  getValues(): string[] | string | undefined {
    if (!this.multi) {
      return this.values.length > 0 ? this.values[0].column_name : undefined;
    }
    return this.values.map(option => option.column_name);
  }
}
