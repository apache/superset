import { configure } from '@superset-ui/translation';

if (typeof window !== 'undefined') {
  const root = document.getElementById('app');
  const bootstrapData = root ? JSON.parse(root.getAttribute('data-bootstrap')) : {};
  if (bootstrapData.common && bootstrapData.common.language_pack) {
    const languagePack = bootstrapData.common.language_pack;
    delete bootstrapData.common.locale;
    delete bootstrapData.common.language_pack;
    configure({ languagePack });
  } else {
    configure();
  }
}
