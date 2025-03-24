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
import { Disposable } from '@apache-superset/primitives';
import { getExtensionsContextValue } from './ExtensionsContextUtils';

export const core = {
  registerView: (id: string, view: React.ReactElement): void => {
    const { registerView: register } = getExtensionsContextValue();
    register(id, view);
  },
};

// Export an object what contains a commands key and a registerCommand function
export const commands = {
  registerCommand(
    command: string,
    callback: (...args: any[]) => any,
    thisArg?: any,
  ): Disposable {
    console.log('registering command', command);
    return new Disposable(() => {
      console.log('disposing command', command);
    });
  },
};

export const sqlLab = {
  databases: [
    {
      name: 'database1',
    },
    {
      name: 'database2',
    },
    {
      name: 'database3',
    },
  ],
};
