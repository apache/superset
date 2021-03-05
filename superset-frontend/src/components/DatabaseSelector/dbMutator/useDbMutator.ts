import { useEffect, useRef } from 'react';

import { factoryDbMutator } from './factoryDbMutator';

export const useDbMutator = ({
  getDbList,
  handleError,
}: {
  getDbList?: (arg0: any) => {};
  handleError: (msg: string) => void;
}) => {
  const dbMutator = useRef(
    factoryDbMutator({
      getDbList,
      handleError,
    }),
  );
  useEffect(() => {
    dbMutator.current = factoryDbMutator({
      getDbList,
      handleError,
    });
  }, [getDbList, handleError]);

  return dbMutator;
};
