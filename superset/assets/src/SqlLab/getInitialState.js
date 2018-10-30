import shortid from 'shortid';
import { t } from '@superset-ui/translation';
import getToastsFromPyFlashMessages from '../messageToasts/utils/getToastsFromPyFlashMessages';

export default function getInitialState({ defaultDbId, ...restBootstrapData }) {
  const defaultQueryEditor = {
    id: shortid.generate(),
    title: t('Untitled Query'),
    sql: 'SELECT *\nFROM\nWHERE',
    selectedText: null,
    latestQueryId: null,
    autorun: false,
    dbId: defaultDbId,
  };

  return {
    sqlLab: {
      activeSouthPaneTab: 'Results',
      alerts: [],
      databases: {},
      offline: false,
      queries: {},
      queryEditors: [defaultQueryEditor],
      tabHistory: [defaultQueryEditor.id],
      tables: [],
      queriesLastUpdate: Date.now(),
      ...restBootstrapData,
    },
    messageToasts: getToastsFromPyFlashMessages(
      (restBootstrapData.common || {}).flash_messages || [],
    ),
  };
}
