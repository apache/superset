// DODO-changed
import {
  initFeatureFlags,
  isFeatureEnabled,
  FeatureFlag,
} from 'src/featureFlags';
import { PLUGIN_SELECTOR } from 'src/Superstructure/constants';

function getDomainsConfig() {
  const appContainer = document.getElementById(PLUGIN_SELECTOR);
  if (!appContainer) {
    return [];
  }

  const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
  // this module is a little special, it may be loaded before index.jsx,
  // where window.featureFlags get initialized
  // eslint-disable-next-line camelcase
  initFeatureFlags(bootstrapData?.common?.feature_flags);
  const availableDomains = new Set([window.location.hostname]);
  if (
    isFeatureEnabled(FeatureFlag.ALLOW_DASHBOARD_DOMAIN_SHARDING) &&
    bootstrapData &&
    bootstrapData.common &&
    bootstrapData.common.conf &&
    bootstrapData.common.conf.SUPERSET_WEBSERVER_DOMAINS
  ) {
    bootstrapData.common.conf.SUPERSET_WEBSERVER_DOMAINS.forEach(hostName => {
      availableDomains.add(hostName);
    });
  }
  return Array.from(availableDomains);
}

export const availableDomains = getDomainsConfig();

export const allowCrossDomain = availableDomains.length > 1;
