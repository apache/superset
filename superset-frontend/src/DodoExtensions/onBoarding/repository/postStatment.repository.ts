import { SupersetClient } from '@superset-ui/core';
import { StepTwoPopupDto } from '../components/stepTwoPopup/stepTwoPopup.dto';
import { UserFromEnum } from '../types';
import { OnboardingFinishSuccessPayload } from '../model/types/start.types';

type RequestDto = {
  is_new_team: boolean;
  team: string;
  team_slug: string;
  is_external: boolean;
  request_roles: Array<string>;
};

type ResponseDto = {
  result: {
    is_onboarding_finished: boolean;
  };
};

export const postStatementRepository = async (
  popupDto: StepTwoPopupDto,
): Promise<OnboardingFinishSuccessPayload> => {
  const requestDto: RequestDto = {
    is_new_team: popupDto.isNewTeam,
    is_external: popupDto.userFrom === UserFromEnum.Franchisee,
    team: popupDto.teamName,
    team_slug: popupDto.teamSlug,
    request_roles: popupDto.roles,
  };

  const response = await SupersetClient.post({
    url: '/api/v1/statement/',
    body: JSON.stringify(requestDto),
    headers: { 'Content-Type': 'application/json' },
    parseMethod: null,
  });

  const responseDto: ResponseDto = await response.json();

  return {
    isOnboardingFinished: responseDto.result.is_onboarding_finished,
  };
};
