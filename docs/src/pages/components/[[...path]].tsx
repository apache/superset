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
import React, { useEffect } from 'react';
import { useHistory, useLocation } from '@docusaurus/router';
import versions from '../../../components/versions.json';

export default function ComponentsRedirect(): JSX.Element {
  const history = useHistory();
  const location = useLocation();

  useEffect(() => {
    // Get the latest released version (first one in the versions array)
    const latestVersion = versions.length > 0 ? versions[0] : '1.0.0';

    // Get the current path (everything after /components/)
    const currentPath = location.pathname.replace(/^\/components\/?/, '');

    // If we're already on a versioned path (e.g., /components/1.0.0/...), don't redirect
    if (currentPath.match(/^(next|[\d.]+)\//)) {
      return;
    }

    // Construct the redirect URL
    let redirectUrl = `/components/${latestVersion}`;
    if (currentPath) {
      redirectUrl += `/${currentPath}`;
    }

    // Only redirect if we're not already at the target URL
    if (location.pathname !== redirectUrl) {
      history.replace(redirectUrl);
    }
  }, [history, location]);

  return (
    <div>
      <p>Redirecting to Component Library...</p>
    </div>
  );
}
