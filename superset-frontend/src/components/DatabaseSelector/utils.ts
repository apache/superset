import _ from 'lodash';
import { DatabaseObject } from '.';

export function isPrestoDatabase(database: DatabaseObject | undefined) {
  return _.isEqual(database?.backend, 'presto');
}
