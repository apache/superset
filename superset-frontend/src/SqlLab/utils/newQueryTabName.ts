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

import { t } from '@superset-ui/core';
import { QueryEditor } from '../types';

const untitledQueryRegex = /^Untitled Query (\d+)$/; // Literal notation isn't recompiled
const untitledQuery = 'Untitled Query ';

export const newQueryTabName = (
  queryEditors: QueryEditor[],
  initialTitle = `${untitledQuery}1`,
): string => {
  const resultTitle = t(initialTitle);

  if (queryEditors.length > 0) {
    const mappedUntitled = queryEditors.filter(
      qe => qe.name?.match(untitledQueryRegex),
    );
    const untitledQueryNumbers = mappedUntitled.map(
      qe => +qe.name.replace(untitledQuery, ''),
    );
    if (untitledQueryNumbers.length > 0) {
      // When there are query tabs open, and at least one is called "Untitled Query #"
      // Where # is a valid number
      const largestNumber: number = Math.max(...untitledQueryNumbers);
      return t('%s%s', untitledQuery, largestNumber + 1);
    }
    return resultTitle;
  }

  return resultTitle;
};
