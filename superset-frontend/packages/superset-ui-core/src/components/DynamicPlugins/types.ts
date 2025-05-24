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
import type { ChartMetadata } from '@superset-ui/core';

export type PluginContextType = {
  loading: boolean;
  /** These are actually only the dynamic plugins */
  dynamicPlugins: {
    [key: string]: {
      key: string;
      mounting: boolean;
      error: null | Error;
    };
  };
  keys: string[];
  /** Mounted means the plugin's js bundle has been imported */
  mountedPluginMetadata: Record<string, ChartMetadata>;
  fetchAll: () => void;
};

// the plugin returned from the API
export type Plugin = {
  name: string;
  key: string;
  bundle_url: string;
  id: number;
};

// when a plugin completes loading
export type CompleteAction = {
  type: 'complete';
  key: string;
  error: null | Error;
};

// when plugins start loading
export type BeginAction = {
  type: 'begin';
  keys: string[];
};

export type ChangedKeysAction = {
  type: 'changed keys';
};

export type PluginAction = BeginAction | CompleteAction | ChangedKeysAction;
