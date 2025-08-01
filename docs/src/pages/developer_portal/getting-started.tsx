import React, { useEffect } from 'react';
import { useHistory } from '@docusaurus/router';
import versions from '../../../developer_portal/versions.json';

export default function DeveloperPortalGettingStartedRedirect(): JSX.Element {
  const history = useHistory();

  useEffect(() => {
    // Get the latest released version (first one in the versions array)
    const latestVersion = versions.length > 0 ? versions[0] : '1.0.0';
    // Redirect to the latest version
    history.replace(`/developer_portal/${latestVersion}/getting-started`);
  }, [history]);

  return (
    <div>
      <p>Redirecting to Developer Portal Getting Started...</p>
    </div>
  );
}
