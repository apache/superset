import shortid from 'shortid';
import { t } from '../locales';

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
      alerts: [],
      queries: {},
      databases: {},
      queryEditors: [defaultQueryEditor],
      tabHistory: [defaultQueryEditor.id],
      tables: [],
      queriesLastUpdate: 0,
      activeSouthPaneTab: 'Results',
      ...restBootstrapData, // @TODO do something with flash_messages?
    },
    messageToasts: [],
  };
}
