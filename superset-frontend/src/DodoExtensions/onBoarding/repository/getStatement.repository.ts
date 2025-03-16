import { SupersetClient } from '@superset-ui/core';
import { SingleStatementModel } from '../model/types/request.types';
import { SingleStatementDto } from './singleStatement.dto';
import { singleStatementFactory } from './singleStatement.factory';

export const getStatementRepository = async (
  id: string,
): Promise<SingleStatementModel | null> => {
  const url = `/api/v1/statement/${id}`;

  const response = await SupersetClient.get({
    url,
    headers: { 'Content-Type': 'application/json' },
    parseMethod: null,
  });

  const dto: SingleStatementDto = await response.json();

  return singleStatementFactory(dto);
};
