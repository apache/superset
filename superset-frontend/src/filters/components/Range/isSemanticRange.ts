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
import { DatasourceKey, DatasourceType } from '@superset-ui/core';

/** Identify numeric filters whose source cannot provide aggregate bounds. */
export default function isSemanticRange(formData: {
  datasource?: string;
  viz_type?: string;
  vizType?: string;
}): boolean {
  return (
    (formData.viz_type ?? formData.vizType) === 'filter_range' &&
    new DatasourceKey(formData.datasource ?? '').type ===
      DatasourceType.SemanticView
  );
}
