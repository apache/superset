import { OnboardingRequestListState } from '../types/requestList.types';

export const getRequestListLoading = (state: {
  onboardingRequestList: OnboardingRequestListState;
}) => state.onboardingRequestList.isLoading;
