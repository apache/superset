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

import { MapBootstrapData } from '../types';

let cachedBootstrapData: MapBootstrapData | null = null;

const DEFAULT_BOOTSTRAP_DATA: MapBootstrapData = {
  common: {
    conf: {
      MAP_PROJECTIONS: {},
      MAP_DEFAULT_LAYERS: [],
    },
  },
};

/**
 * Based on superset-frontend/src/utils/getBootstrapData.ts. Replicated
 * in order to circumvent creating circular dependencies.
 */
export default function getBootstrapData() {
  if (cachedBootstrapData === null) {
    const appContainer = document.getElementById('app');
    const dataBootstrap = appContainer?.getAttribute('data-bootstrap');
    cachedBootstrapData = dataBootstrap ? JSON.parse(dataBootstrap) : null;
  }
  // Add a fallback to ensure the returned value is always of type BootstrapData
  return cachedBootstrapData ?? DEFAULT_BOOTSTRAP_DATA;
}

export const getMapProjections = () => {
  const bootstrapData = getBootstrapData();
  const mapProjections = bootstrapData?.common?.conf?.MAP_PROJECTIONS;
  return mapProjections ?? {};
};

export const getMapDefaultLayers = () => {
  const bootstrapData = getBootstrapData();
  const mapDefaultLayers = bootstrapData?.common?.conf?.MAP_DEFAULT_LAYERS;
  return mapDefaultLayers ?? [];
};
