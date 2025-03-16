import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import { User } from '../types';

enum Operation {
  Contains = 'usr_name',
}

type ResponseDtoRecord = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  teams: Array<{ name: string }>;
  user_info: Array<{ country_name: string | null }>;
};

type ResponseDto = {
  result: Array<ResponseDtoRecord>;
};

const fromDtoFactory = (dtoRecord: ResponseDtoRecord): User => {
  const teams = dtoRecord.teams.map(item => item.name).join(', ');
  return {
    value: dtoRecord.id,
    label: `${dtoRecord.first_name} ${dtoRecord.last_name} ${
      teams ? `(${teams})` : '(no team)'
    } ${dtoRecord.email} (${
      dtoRecord.user_info[0]?.country_name?.toUpperCase() || 'no country'
    })`,
  };
};

export const getUsersRepository = async (
  query: string,
): Promise<Array<User>> => {
  const filterExps = [
    { col: 'first_name', opr: Operation.Contains, value: query },
  ];

  const queryParams = rison.encode_uri({ filters: filterExps });

  const url = `/api/v1/dodo_user/?q=${queryParams}`;

  const response = await SupersetClient.get({
    url,
    headers: { 'Content-Type': 'application/json' },
    parseMethod: null,
  });

  const dto: ResponseDto = await response.json();
  return dto.result.map(item => fromDtoFactory(item));
};
