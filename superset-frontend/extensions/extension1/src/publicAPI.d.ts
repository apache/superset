import { core } from '@apache-superset/types';

export interface Extension1API {
  formatDatabase: (database: core.Database) => string;
}
