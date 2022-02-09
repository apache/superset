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

import React, { ComponentType } from 'react';
import { JsonObject } from '@superset-ui/core';

export interface RegistryMetadata {
  description: string;
  name: string;
}

export interface ComponentItem<Metadata = RegistryMetadata> {
  metadata: Metadata;
  loadComponent: () => Promise<{ default: ComponentType<any> }>;
}

export interface ComponentRegistry<Metadata = RegistryMetadata> {
  metadata: Metadata;
  Component: ComponentType<any>;
}

export type FunctionalRegistryState<RegistryT> = {
  registry: { [key: string]: RegistryT & { key: string } };
  registryKeys: string[];
};

export const registryGetAll =
  <RegistryT>({ registryKeys, registry }: FunctionalRegistryState<RegistryT>) =>
  () =>
    registryKeys.map(key => registry[key]);

export const registryDelete =
  <RegistryT>({ registryKeys, registry }: FunctionalRegistryState<RegistryT>) =>
  (keyToDelete: string) => {
    // eslint-disable-next-line no-param-reassign
    registryKeys = registryKeys.filter(key => key !== keyToDelete);
    // eslint-disable-next-line no-param-reassign
    delete registry[keyToDelete];
  };

export const registryGet =
  <RegistryT>({ registry }: FunctionalRegistryState<RegistryT>) =>
  (key: string) =>
    registry[key];

export const registrySet =
  ({ registryKeys, registry }: FunctionalRegistryState<JsonObject>) =>
  (key: string, item: JsonObject) => {
    registryKeys.push(key);
    // eslint-disable-next-line no-param-reassign
    registry[key] = {
      key,
      ...item,
    };
  };

export const registrySetComponent =
  ({ registryKeys, registry }: FunctionalRegistryState<ComponentRegistry>) =>
  (key: string, item: ComponentItem) => {
    registryKeys.push(key);
    // eslint-disable-next-line no-param-reassign
    registry[key] = {
      key,
      metadata: item.metadata,
      Component: React.lazy(item.loadComponent),
    };
  };
