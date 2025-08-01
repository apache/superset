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
