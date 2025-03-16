import { User } from '../../types';

export const ONBOARDING_USER_SEARCH_PENDING = 'ONBOARDING_USER_SEARCH_PENDING';
export const ONBOARDING_USER_SEARCH_SUCCESS = 'ONBOARDING_USER_SEARCH_SUCCESS';
export const ONBOARDING_USER_SEARCH_ERROR = 'ONBOARDING_USER_SEARCH_ERROR';
export const ONBOARDING_USER_SEARCH_CLEAR = 'ONBOARDING_USER_SEARCH_CLEAR';

type Pending = {
  type: typeof ONBOARDING_USER_SEARCH_PENDING;
};

type Success = {
  type: typeof ONBOARDING_USER_SEARCH_SUCCESS;
  payload: User[];
};

type Error = {
  type: typeof ONBOARDING_USER_SEARCH_ERROR;
  payload: { error: string };
};

type Clear = {
  type: typeof ONBOARDING_USER_SEARCH_CLEAR;
};

export type OnboardingUserSearchAction = Pending | Success | Error | Clear;

export type OnboardingUserSearchState = {
  pending: boolean;
  data: Array<User>;
  error: string | null;
};
