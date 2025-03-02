export const createErrorHandler =
  (errMsg: (message: string) => void) => (error: any) => {
    const message = error.error || error.message || error.statusText;
    errMsg(`There was an issue deleting query 0: ${message}`);
    return error;
  };

export const getFilterValues = () => ({});

export const PAGE_SIZE = 25;

export const shortenSQL = (sql: string, maxLength: number) => sql;

export const CardContainer = ({ children }: any) => children;
