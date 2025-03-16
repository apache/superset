import { Team } from '../../types';

export const ONBOARDING_TEAM_SEARCH_PENDING = 'ONBOARDING_TEAM_SEARCH_PENDING';
export const ONBOARDING_TEAM_SEARCH_SUCCESS = 'ONBOARDING_TEAM_SEARCH_SUCCESS';
export const ONBOARDING_TEAM_SEARCH_ERROR = 'ONBOARDING_TEAM_SEARCH_ERROR';
export const ONBOARDING_TEAM_SEARCH_CLEAR = 'ONBOARDING_TEAM_SEARCH_CLEAR';

type Pending = {
  type: typeof ONBOARDING_TEAM_SEARCH_PENDING;
};

type Success = {
  type: typeof ONBOARDING_TEAM_SEARCH_SUCCESS;
  payload: Team[];
};

type Error = {
  type: typeof ONBOARDING_TEAM_SEARCH_ERROR;
  payload: { error: string };
};

type Clear = {
  type: typeof ONBOARDING_TEAM_SEARCH_CLEAR;
};

type OnboardingTeamSearchAction = Pending | Success | Error | Clear;

type OnboardingTeamSearchState = {
  pending: boolean;
  data: Array<Team>;
  error: string | null;
};

export type { OnboardingTeamSearchState, OnboardingTeamSearchAction };
