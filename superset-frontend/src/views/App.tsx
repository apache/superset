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
import { RouterProvider } from '@tanstack/react-router';
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';
import getBootstrapData from 'src/utils/getBootstrapData';
import setupApp from 'src/setup/setupApp';
import setupPlugins from 'src/setup/setupPlugins';
import setupCodeOverrides from 'src/setup/setupCodeOverrides';
import { router } from 'src/router';

setupApp();
setupPlugins();
setupCodeOverrides();
setupAGGridModules();

const bootstrapData = getBootstrapData();

// WCAG 3.1.2: Set the HTML lang attribute based on the current locale
// so screen readers announce the correct language for the page content.
// Normalize to BCP-47 format by replacing underscores with hyphens
// so region subtags like "pt_BR" become valid "pt-BR" rather than being dropped.
const locale =
  bootstrapData.common?.locale || window.navigator.language || 'en';
document.documentElement.lang = String(locale).replace(/_/g, '-');

const App = () => <RouterProvider router={router} />;

export default App;
