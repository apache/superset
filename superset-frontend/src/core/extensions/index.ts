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
import type { extensions as extensionsApi } from '@apache-superset/core';
import ExtensionsLoader from 'src/extensions/ExtensionsLoader';

export {
  createExtensionContext,
  createBoundGetContext,
} from 'src/extensions/ExtensionContext';

const getContext: typeof extensionsApi.getContext = () => {
  throw new Error(
    'getContext() must be called within an extension context. ' +
      'Ensure this code is being executed by an extension.',
  );
};

const getExtension: typeof extensionsApi.getExtension = id =>
  ExtensionsLoader.getInstance().getExtension(id);

const getAllExtensions: typeof extensionsApi.getAllExtensions = () =>
  ExtensionsLoader.getInstance().getExtensions();

export const extensions: typeof extensionsApi = {
  getContext,
  getExtension,
  getAllExtensions,
};
