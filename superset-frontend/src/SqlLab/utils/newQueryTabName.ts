import { QueryEditor } from '../types';
import { t } from '@superset-ui/core';

const untitledQueryRegex: RegExp = /^Untitled Query (\d+)$/; // Literal notation isn't recompiled
const untitledQuery = 'Untitled Query ';

export const newQueryTabName = (
  queryEditors: QueryEditor[],
  initialTitle = `${untitledQuery} 1`,
): string => {
  if (queryEditors.length > 0) {
    const untitledQueryNumbers: number[] = queryEditors
      .filter(qe => qe.title.match(untitledQueryRegex))
      .map(qe => +qe.title.replace(untitledQuery, ''));

    if (untitledQueryNumbers.length > 0) {
      // When there are query tabs open, and at least one is called "Untitled Query #"
      // Where # is a valid number
      const largestNumber: number = Math.max(...untitledQueryNumbers);
      return t(`${untitledQuery}%s`, largestNumber + 1);
    } else {
      return initialTitle;
    }
  } else {
    return initialTitle;
  }
};
