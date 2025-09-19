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
import { core as coreType } from '@apache-superset/core';
import { getExtensionsContextValue } from '../extensions/ExtensionsContextUtils';
import { Disposable } from './models';

export const registerViewProvider: typeof coreType.registerViewProvider = (
  id,
  viewProvider,
) => {
  const { registerViewProvider: register, unregisterViewProvider: unregister } =
    getExtensionsContextValue();
  register(id, viewProvider);
  return new Disposable(() => unregister(id));
};

const { GenericDataType } = coreType;

export const core: typeof coreType = {
  GenericDataType,
  registerViewProvider,
  Disposable,
};

export * from './authentication';
export * from './commands';
export * from './extensions';
export * from './environment';
export * from './models';
export * from './sqlLab';
export * from './utils';
