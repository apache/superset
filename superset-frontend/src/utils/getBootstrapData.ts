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

import { jsonrepair } from 'jsonrepair';
import { BootstrapData } from 'src/types/bootstrapTypes';
import { DEFAULT_BOOTSTRAP_DATA } from 'src/constants';
import { logging } from '@superset-ui/core';

export default function getBootstrapData(): BootstrapData {
  const appContainer = document.getElementById('app');
  const dataBootstrapString = appContainer?.getAttribute('data-bootstrap');
  if (!dataBootstrapString) {
    return DEFAULT_BOOTSTRAP_DATA;
  }
  try {
    return JSON.parse(dataBootstrapString);
  } catch (error) {
    try {
      return JSON.parse(jsonrepair(dataBootstrapString));
    } catch (error) {
      logging.error(
        'Malformed JSON in bootstrap data. Using default data instead',
        error,
      );
      return DEFAULT_BOOTSTRAP_DATA;
    }
  }
}
