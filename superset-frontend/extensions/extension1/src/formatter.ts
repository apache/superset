import { core } from '@apache-superset/types';

export const formatDatabase = (database: core.Database): string =>
  `Database: ${database.id} - ${database.name}`;
