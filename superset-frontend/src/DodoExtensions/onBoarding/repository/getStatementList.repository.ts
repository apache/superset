import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import { ActionRequestListSuccessPayload } from '../model/types/requestList.types';
import { FetchDataConfig } from '../../../components/ListView';

type ResponseDto = {
  count: number;
  result: Array<{
    id: number;
    request_roles: Array<{
      id: number;
      name: string;
    }>;
    team: string;
    team_slug: string;
    created_datetime: string;
    finished: boolean;
    user: Array<{
      id: number;
      email: string;
      first_name: string;
      last_name: string;
    }>;
  }>;
};

export const getStatementListRepository = async ({
  pageIndex,
  pageSize,
  sortBy,
  filters: filterValues,
}: FetchDataConfig): Promise<ActionRequestListSuccessPayload> => {
  const filterExps = filterValues.map(({ id, operator: opr, value }) => ({
    col: id,
    opr,
    value:
      value && typeof value === 'object' && 'value' in value
        ? value.value
        : value,
  }));

  const queryParams = rison.encode_uri({
    order_column: sortBy[0].id,
    order_direction: sortBy[0].desc ? 'desc' : 'asc',
    page: pageIndex,
    page_size: pageSize,
    ...(filterExps.length ? { filters: filterExps } : {}),
  });

  const url = `/api/v1/statement/?q=${queryParams}`;

  const response = await SupersetClient.get({
    url,
    headers: { 'Content-Type': 'application/json' },
    parseMethod: null,
  });

  const dto: ResponseDto = await response.json();

  return {
    count: dto.count,
    rows: dto.result.map(item => ({
      id: item.id,
      user: `${item.user.at(0)?.first_name ?? ''} ${
        item.user.at(0)?.last_name ?? ''
      }`,
      email: item.user.at(0)?.email ?? '',
      team: `${item.team} (${item.team_slug})`,
      requestedRoles: item.request_roles.map(role => role.name).join(', '),
      isClosed: item.finished,
      requestDate: new Date(
        item.created_datetime.includes('Z')
          ? item.created_datetime
          : `${item.created_datetime}Z`,
      ),
    })),
  };
};
