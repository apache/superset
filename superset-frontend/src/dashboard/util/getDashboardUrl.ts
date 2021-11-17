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
import rison from 'rison';
import { JsonObject } from '@superset-ui/core';
import { URL_PARAMS } from 'src/constants';
import replaceUndefinedByNull from './replaceUndefinedByNull';
import serializeActiveFilterValues from './serializeActiveFilterValues';
import { DataMaskState } from '../../dataMask/types';

export default function getDashboardUrl({
  pathname,
  filters = {},
  hash = '',
  standalone,
  dataMask,
}: {
  pathname: string;
  filters: JsonObject;
  hash: string;
  standalone?: number | null;
  dataMask?: DataMaskState;
}) {
  const newSearchParams = new URLSearchParams();

  // convert flattened { [id_column]: values } object
  // to nested filter object
  newSearchParams.set(
    URL_PARAMS.preselectFilters.name,
    JSON.stringify(serializeActiveFilterValues(filters)),
  );

  if (standalone) {
    newSearchParams.set(URL_PARAMS.standalone.name, standalone.toString());
  }

  if (dataMask) {
    newSearchParams.set(
      URL_PARAMS.nativeFilters.name,
      rison.encode(replaceUndefinedByNull(dataMask)),
    );
  }

  const hashSection = hash ? `#${hash}` : '';
  return `${pathname}?${newSearchParams.toString()}${hashSection}`;
}
