import { SupersetClient } from '@superset-ui/core';
import { TeamPageSuccessPayload } from '../model/types/teamPage.types';

type ResponseDto = {
  result: {
    id: number;
    is_external: boolean;
    name: string;
    slug: string;
    participants: Array<{
      created_on: string;
      email: string;
      first_name: string;
      id: number;
      last_login: string;
      last_name: string;
      login_count: number;
      username: string;
    }>;
    roles: Array<{
      id: number;
      name: string;
    }>;
  };
};

export const getTeamPageRepository = async (
  id: string,
): Promise<TeamPageSuccessPayload | null> => {
  const url = `/api/v1/team/${id}`;

  const response = await SupersetClient.get({
    url,
    headers: { 'Content-Type': 'application/json' },
    parseMethod: null,
  });

  const dto: ResponseDto = await response.json();

  return {
    id: dto.result.id,
    isExternal: dto.result.is_external,
    name: dto.result.name,
    slug: dto.result.slug,
    membersCount: dto.result.participants.length,
    roles: dto.result.roles.map(role => role.name).join(', '),
    participants: dto.result.participants.map(item => ({
      id: item.id,
      username: item.username,
      firstName: item.first_name,
      lastName: item.last_name,
      email: item.email,
      createdOn: new Date(
        item.created_on.includes('Z') ? item.created_on : `${item.created_on}Z`,
      ),
      lastLogin: new Date(
        item.created_on.includes('Z') ? item.last_login : `${item.last_login}Z`,
      ),

      loginCount: item.login_count,
    })),
  };
};
