function getDomainsConfig() {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    return [];
  }

  const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
  const availableDomains = new Set([location.hostname]);
  if (bootstrapData &&
    bootstrapData.common &&
    bootstrapData.common.conf &&
    bootstrapData.common.conf.SUPERSET_WEBSERVER_DOMAINS
  ) {
    bootstrapData.common.conf.SUPERSET_WEBSERVER_DOMAINS.forEach((hostName) => {
      availableDomains.add(hostName);
    });
  }
  return Array.from(availableDomains);
}

export const availableDomains = getDomainsConfig();

export const allowCrossDomain = availableDomains.length > 1;
