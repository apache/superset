export const ONBOARDING_TEAM_ADD_USER_PENDING =
  'ONBOARDING_TEAM_ADD_USER_PENDING';
export const ONBOARDING_TEAM_ADD_USER_SUCCESS =
  'ONBOARDING_TEAM_ADD_USER_SUCCESS';
export const ONBOARDING_TEAM_ADD_USER_ERROR = 'ONBOARDING_TEAM_ADD_USER_ERROR';
export const ONBOARDING_TEAM_ADD_USER_CLEAR = 'ONBOARDING_TEAM_ADD_USER_CLEAR';

type ActionTeamAddUserPending = {
  type: typeof ONBOARDING_TEAM_ADD_USER_PENDING;
};

type ActionTeamAddUserSuccess = {
  type: typeof ONBOARDING_TEAM_ADD_USER_SUCCESS;
};

type ActionTeamAddUserError = {
  type: typeof ONBOARDING_TEAM_ADD_USER_ERROR;
  payload: { error: string };
};

type ActionTeamAddUserClear = {
  type: typeof ONBOARDING_TEAM_ADD_USER_CLEAR;
};

export type OnboardingTeamAddUserAction =
  | ActionTeamAddUserPending
  | ActionTeamAddUserSuccess
  | ActionTeamAddUserError
  | ActionTeamAddUserClear;

export type OnboardingTeamAddUserState = {
  pending: boolean;
  success: boolean;
  error: string | null;
};
