import { SupersetClient } from '@superset-ui/core';

type Params = {
  teamId: number;
  userId: number;
};

export const postTeamRemoveUserRepository = async (
  params: Params,
): Promise<void> => {
  const response = await SupersetClient.post({
    url: '/api/v1/team/remove_user',
    body: JSON.stringify({
      team_id: params.teamId,
      user_id: params.userId,
    }),
    headers: { 'Content-Type': 'application/json' },
    parseMethod: null,
  });

  await response.json();
};
