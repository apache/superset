import { OnboardingRequestState } from '../types/request.types';

export const getRequestLoading = (state: {
  onboardingRequest: OnboardingRequestState;
}) => state.onboardingRequest.requestIsLoading;
