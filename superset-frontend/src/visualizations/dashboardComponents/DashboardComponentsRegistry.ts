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
import {
  ComponentItem,
  ComponentRegistry,
  FunctionalRegistryState,
  registryDelete,
  registryGet,
  registryGetAll,
  RegistryMetadata,
  registrySetComponent,
} from '../../utils/functionalRegistry';

export interface DashboardComponentsRegistryMetadata extends RegistryMetadata {
  iconName: string;
}

/*
  This is registry that contains list of dynamic dashboard components that can be added in addition to main components
 */

const DashboardComponentsRegistry = (
  initComponents: { key: string; item: ComponentItem }[] = [],
) => {
  const state: FunctionalRegistryState<
    ComponentRegistry<DashboardComponentsRegistryMetadata>
  > = {
    registry: {},
    registryKeys: [],
  };

  const set = registrySetComponent(state);

  initComponents.forEach(({ key, item }) => {
    set(key, item);
  });

  return {
    set,
    get: registryGet(state),
    delete: registryDelete(state),
    getAll: registryGetAll(state),
  };
};

export default DashboardComponentsRegistry;
