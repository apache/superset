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

import { setSemanticLayerUtilities } from '@superset-ui/chart-controls';
import withAsyncVerification from 'src/explore/components/controls/withAsyncVerification';
import {
  createMetricsVerification,
  createColumnsVerification,
  createSemanticLayerOnChange,
  SEMANTIC_LAYER_CONTROL_FIELDS,
} from 'src/explore/components/controls/SemanticLayerVerification';

/**
 * Initialize semantic layer controls by setting up the utilities
 * in the chart controls package.
 */
export default function setupSemanticLayer() {
  setSemanticLayerUtilities({
    withAsyncVerification,
    createMetricsVerification,
    createColumnsVerification,
    createSemanticLayerOnChange,
    SEMANTIC_LAYER_CONTROL_FIELDS,
  });
}
