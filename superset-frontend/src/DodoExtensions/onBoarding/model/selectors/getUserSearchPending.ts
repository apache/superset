import { OnboardingUserSearchState } from '../types/userSearch.types';

export const getUserSearchPending = (state: {
  onboardingUserSearch: OnboardingUserSearchState;
}) => state.onboardingUserSearch.pending;
