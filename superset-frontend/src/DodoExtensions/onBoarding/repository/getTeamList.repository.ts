import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import { FetchDataConfig } from '../../../components/ListView';
import { OnboardingTeamListSuccessPayload } from '../model/types/teamList.types';

type ResponseDto = {
  count: number;
  result: Array<{
    id: number;
    is_external: boolean;
    roles: Array<{
      id: number;
      name: string;
    }>;
    name: string;
    slug: string;
    participants: Array<{
      id: number;
      first_name: string;
      last_name: string;
    }>;
  }>;
};

export const getTeamListRepository = async ({
  pageIndex,
  pageSize,
  sortBy,
  filters: filterValues,
}: FetchDataConfig): Promise<OnboardingTeamListSuccessPayload> => {
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

  const url = `/api/v1/team/?q=${queryParams}`;

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
      name: item.name,
      slug: item.slug,
      roles: item.roles.map(role => role.name).join(', '),
      isExternal: item.is_external,
      membersCount: item.participants.length,
    })),
  };
};
