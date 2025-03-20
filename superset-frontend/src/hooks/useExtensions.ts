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
import { useEffect, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';

interface Extension {
  scope: string;
  exposedModules: string[];
  remoteEntry: string;
}

export interface ResolvedModule {
  // TODO: The resolved module might be a Javascript function. We need to add
  // more metadata for callers to handle how to interact with the module.
  default: React.ComponentType;
}

const loadExtension = async ({
  scope,
  exposedModules,
  remoteEntry,
}: Extension): Promise<ResolvedModule[]> => {
  await new Promise<void>((resolve, reject) => {
    const element = document.createElement('script');
    element.src = remoteEntry;
    element.type = 'text/javascript';
    element.async = true;
    element.onload = () => {
      resolve();
    };
    element.onerror = () => {
      reject(new Error(`Failed to load ${remoteEntry}`));
    };
    document.head.appendChild(element);
  });

  // @ts-ignore
  await __webpack_init_sharing__('default');
  const container = (window as any)[scope];

  // @ts-ignore
  await container.init(__webpack_share_scopes__.default);

  return Promise.all(
    exposedModules.map(async module => {
      const factory = await container.get(module);
      const Module = factory();
      return Module;
    }),
  );
};

// TODO: We need to add filter to only load the extensions of a particular module or based on activation events.
const useExtensions = () => {
  const [extensions, setExtensions] = useState<ResolvedModule[]>([]);

  useEffect(() => {
    const fetchExtensions = async () => {
      try {
        const response = await SupersetClient.get({
          endpoint: '/api/v1/extensions/',
        });
        const extensions: Extension[] = response.json.result;
        const loadedExtensionsArray = await Promise.all(
          extensions.map(async extension => {
            const Modules = await loadExtension(extension);
            return Modules;
          }),
        );

        setExtensions(loadedExtensionsArray.flat());
      } catch (error) {
        console.error('Failed to load extensions:', error);
      }
    };

    fetchExtensions();
  }, []);

  return extensions;
};

export default useExtensions;
