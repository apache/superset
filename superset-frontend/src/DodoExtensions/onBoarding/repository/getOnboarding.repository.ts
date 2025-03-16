import { makeApi } from '@superset-ui/core';
import { OnboardingSuccessPayload } from '../model/types/start.types';

type ResponseDto = {
  result: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    is_onboarding_finished: boolean;
    onboarding_started_time: string | null;
  };
};

export const getOnboardingRepository: () => Promise<OnboardingSuccessPayload> =
  async () => {
    const getMe = makeApi<void, ResponseDto>({
      method: 'GET',
      endpoint: '/api/v1/onboarding/',
    });
    const dto = await getMe();

    return {
      id: dto.result.id,
      isOnboardingFinished: dto.result.is_onboarding_finished ?? false,
      onboardingStartedTime: dto.result.onboarding_started_time,
      firstName: dto.result.first_name,
      lastName: dto.result.last_name,
      email: dto.result.email,
    };
  };
