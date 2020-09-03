import { QueryFormResidualDataValue } from './types/QueryFormData';

export default function processGroupby(groupby: QueryFormResidualDataValue[]): string[] {
  const groupbyList: string[] = [];
  groupby.forEach(value => {
    if (typeof value === 'string') {
      groupbyList.push(value);
    }
  });
  return groupbyList;
}
