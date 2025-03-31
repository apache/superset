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

export interface Contributions {
  views: {
    [key: string]: {
      id: string;
      name: string;
    }[];
  };
  // TODO: Add other types of contributions
}

export interface Extension {
  name: string;
  description: string;
  contributions: Contributions;
  exposedModules: string[];
  remoteEntry: string;
  scope: string;
  activate: Function;
  deactivate: Function;
}

export interface ResolvedModule {
  activate: Function;
  deactivate: Function;
}

const loadModules = async (extension: Extension): Promise<Extension> => {
  const { remoteEntry, scope, exposedModules } = extension;
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

  // TODO: Assuming only index is exposed
  const factory = await container.get(exposedModules[0]);
  const Module = factory();
  return {
    ...extension,
    activate: Module.activate,
    deactivate: Module.deactivate,
  };
};

// TODO: We need to add filter to only load the extensions of a particular module or based on activation events.
const useExtensions = () => {
  const [extensions, setExtensions] = useState<Extension[]>([]);

  useEffect(() => {
    const fetchExtensions = async () => {
      try {
        const response = await SupersetClient.get({
          endpoint: '/api/v1/extensions/',
        });
        const extensions: Extension[] = response.json.result;
        const loadedExtensionsArray = await Promise.all(
          extensions.map(async extension => {
            const modules = await loadModules(extension);
            return {
              ...extension,
              ...modules,
            };
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
