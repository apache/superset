/**
 * Interface for table columns dataset
 */
export interface ITableColumn {
  /**
   * Name of the column
   */
  name: string;
  /**
   * Datatype of the column
   */
  type: string;
}

/**
 * Checks if a given item matches the ITableColumn interface
 * @param item Object to check if it matches the ITableColumn interface
 * @returns boolean true if matches interface
 */
export const isITableColumn = (item: any): boolean => {
  let match = true;
  const BASE_ERROR =
    'The object provided to isITableColumn does match the interface.';
  if (typeof item?.name !== 'string') {
    match = false;
    // eslint-disable-next-line no-console
    console.error(
      `${BASE_ERROR} The property 'name' is required and must be a string`,
    );
  }
  if (match && typeof item?.type !== 'string') {
    match = false;
    // eslint-disable-next-line no-console
    console.error(
      `${BASE_ERROR} The property 'type' is required and must be a string`,
    );
  }
  return match;
};

export interface IDatabaseTable {
  name: string;
  columns: ITableColumn[];
}

/**
 * Checks if a given item matches the isIDatabsetTable interface
 * @param item Object to check if it matches the isIDatabsetTable interface
 * @returns boolean true if matches interface
 */
export const isIDatabaseTable = (item: any): boolean => {
  let match = true;
  if (typeof item?.name !== 'string') {
    match = false;
  }
  if (match && !Array.isArray(item.columns)) {
    match = false;
  }
  if (match && item.columns.length > 0) {
    const invalid = item.columns.some((column: any, index: number) => {
      const valid = isITableColumn(column);
      if (!valid) {
        // eslint-disable-next-line no-console
        console.error(
          `The provided object does not match the IDatabaseTable interface. columns[${index}] is invalid and does not match the ITableColumn interface`,
        );
      }
      return !valid;
    });
    match = !invalid;
  }
  return match;
};
