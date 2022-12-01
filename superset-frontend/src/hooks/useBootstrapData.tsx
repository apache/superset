import { useEffect, useState } from 'react';

import { BootstrapData } from 'src/types/bootstrapTypes';

export function useBootstrapData(): BootstrapData {
  const [bootstrapData, setBootstrapData] = useState<BootstrapData>({});

  useEffect(() => {
    const appContainer = document.getElementById('app');
    const dataBootstrap = appContainer?.getAttribute('data-bootstrap') || '{}';

    setBootstrapData(JSON.parse(dataBootstrap));
  }, []);

  return bootstrapData;
}
