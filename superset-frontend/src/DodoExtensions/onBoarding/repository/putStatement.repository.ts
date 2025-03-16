import { SupersetClient } from '@superset-ui/core';
import { Role } from '../types';
import { SingleStatementDto } from './singleStatement.dto';
import { singleStatementFactory } from './singleStatement.factory';
import { SingleStatementModel } from '../model/types/request.types';

type Params = {
  id: string;
  slug: string;
  roles: Array<Role>;
};

export const putStatementRepository: (
  params: Params,
) => Promise<SingleStatementModel> = async params => {
  const response = await SupersetClient.put({
    url: `/api/v1/statement/${params.id}`,
    body: JSON.stringify({
      team_slug: params.slug,
      is_approved: true,
      request_roles: params.roles,
    }),
    headers: { 'Content-Type': 'application/json' },
    parseMethod: null,
  });

  const dto: SingleStatementDto = await response.json();

  return singleStatementFactory(dto);
};
