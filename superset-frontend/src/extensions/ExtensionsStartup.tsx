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
import * as supersetCore from '@apache-superset/core';
import {
  authentication,
  core,
  commands,
  environment,
  extensions,
  sqlLab,
} from 'src/extensions';
import { useExtensionsContext } from './ExtensionsContext';
import ExtensionsManager from './ExtensionsManager';
import { useSelector } from 'react-redux';
import { RootState } from 'src/views/store';

declare global {
  interface Window {
    superset: {
      authentication: typeof authentication;
      core: typeof core;
      commands: typeof commands;
      environment: typeof environment;
      extensions: typeof extensions;
      sqlLab: typeof sqlLab;
    };
  }
}

const ExtensionsStartup = () => {
  // Initialize the extensions context before initializing extensions
  // This is a prerequisite for the ExtensionsManager to work correctly
  useExtensionsContext();

  const [initialized, setInitialized] = useState(false);

  const userId = useSelector<RootState, number | undefined>(
    ({ user }) => user.userId,
  );

  useEffect(() => {
    // Skip initialization if already initialized or if user is not logged in
    if (initialized || !userId) {
      return;
    }

    // Provide the implementations for @apache-superset/core
    window.superset = {
      ...supersetCore,
      authentication,
      core,
      commands,
      environment,
      extensions,
      sqlLab,
    };

    // Initialize extensions
    try {
      ExtensionsManager.getInstance().initialize();
      console.log('Extensions initialized successfully.');
    } catch (error) {
      console.error('Error setting up extensions:', error);
    } finally {
      setInitialized(true);
    }
  }, [initialized, userId]);

  return null;
};

export default ExtensionsStartup;
