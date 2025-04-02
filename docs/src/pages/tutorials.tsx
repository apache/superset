import React, { useEffect } from 'react';
import { useHistory } from '@docusaurus/router';
import versions from '../../tutorials/versions.json';

export default function TutorialsRedirect(): JSX.Element {
  const history = useHistory();

  useEffect(() => {
    // Get the latest released version (first one in the versions array)
    const latestVersion = versions.length > 0 ? versions[0] : '1.0.0';

    // Redirect to the latest version
    history.replace(`/tutorials/${latestVersion}`);
  }, [history]);

  return (
    <div>
      <p>Redirecting to Tutorials...</p>
    </div>
  );
}
