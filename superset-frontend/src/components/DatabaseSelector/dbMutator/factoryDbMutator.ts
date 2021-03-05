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

export type DbMutator = (data: Database) => any[];

interface DatabaseOption {
  // There are other attributes
  backend: string;
  database_name: string;
}

interface Database {
  result: DatabaseOption[];
}

export const factoryDbMutator = ({
  getDbList,
  handleError,
}: {
  getDbList?: (arg0: any) => {};
  handleError: (msg: string) => void;
}): DbMutator => data => {
  if (getDbList) {
    getDbList(data.result);
  }
  if (data.result.length === 0) {
    handleError(t("It seems you don't have access to any database"));
  }
  return data.result.map(row => ({
    ...row,
    // label is used for the typeahead
    label: `${row.backend} ${row.database_name}`,
  }));
};
