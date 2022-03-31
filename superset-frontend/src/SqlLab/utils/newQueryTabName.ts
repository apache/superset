import { t } from '@superset-ui/core';
import { QueryEditor } from '../types';

const untitledQueryRegex = /^Untitled Query (\d+)$/; // Literal notation isn't recompiled
const untitledQuery = 'Untitled Query ';

export const newQueryTabName = (
  queryEditors: QueryEditor[],
  initialTitle = `${untitledQuery}1`,
): string => {
  const resultTitle = t(initialTitle);

  if (queryEditors.length > 0) {
    const mappedUntitled = queryEditors.filter(qe =>
      qe.title.match(untitledQueryRegex),
    );
    const untitledQueryNumbers = mappedUntitled.map(
      qe => +qe.title.replace(untitledQuery, ''),
    );
    if (untitledQueryNumbers.length > 0) {
      // When there are query tabs open, and at least one is called "Untitled Query #"
      // Where # is a valid number
      const largestNumber: number = Math.max(...untitledQueryNumbers);
      return t(`${untitledQuery}%s`, largestNumber + 1);
    }
    return resultTitle;
  }

  return resultTitle;
};
