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
import { t } from '@apache-superset/core/translation';
import getBootstrapData from 'src/utils/getBootstrapData';

export default function SemanticLayerSetupHelp() {
  const configuredUrl: unknown =
    getBootstrapData().common.conf.SEMANTIC_LAYER_DOCUMENTATION_URL;
  if (
    typeof configuredUrl !== 'string' ||
    !/^https?:\/\//i.test(configuredUrl.trim())
  ) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(configuredUrl.trim());
  } catch {
    return null;
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    return null;
  }
  return (
    <p>
      <a href={url.href} target="_blank" rel="noopener noreferrer">
        {/* COPY-TBD-10: pending product copy. */}
        {t('Semantic layer setup guide')}
      </a>
    </p>
  );
}
