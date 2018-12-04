import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import { configure } from '@superset-ui/translation';
import setupClient from './setup/setupClient';
import setupColors from './setup/setupColors';
import setupFormatters from './setup/setupFormatters';

// Configure translation
if (typeof window !== 'undefined') {
  const root = document.getElementById('app');
  const bootstrapData = root ? JSON.parse(root.getAttribute('data-bootstrap')) : {};
  if (bootstrapData.common && bootstrapData.common.language_pack) {
    const languagePack = bootstrapData.common.language_pack;
    configure({ languagePack });
  } else {
    configure();
  }
} else {
  configure();
}

// Setup SupersetClient
setupClient();

// Setup color palettes
setupColors();

// Setup number formatters
setupFormatters();
