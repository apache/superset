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

/**
 * @fileoverview The view a host page renders to show one artifact on its own:
 * the artifact is the saved widget whose UUID ends the page's address.
 */

import { components, translation } from '@apache-superset/core';
import HostPage from './HostPage';

const { Alert } = components;
const { t } = translation;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The UUID that ends `pathname`, if it ends with one. */
export function artifactIdOf(pathname: string): string | undefined {
  const last = pathname.split('/').filter(Boolean).pop();
  return last && UUID.test(last) ? last.toLowerCase() : undefined;
}

export default function ArtifactPage() {
  const widgetId = artifactIdOf(window.location.pathname);
  if (!widgetId) {
    return (
      <Alert type="warning" closable={false}>
        {t('This address names no artifact.')}
      </Alert>
    );
  }
  return <HostPage widgetId={widgetId} />;
}
