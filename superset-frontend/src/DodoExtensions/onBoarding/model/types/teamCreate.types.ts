import { Role } from '../../types';

export const ONBOARDING_TEAM_CREATE_PENDING = 'ONBOARDING_TEAM_CREATE_PENDING';
export const ONBOARDING_TEAM_CREATE_SUCCESS = 'ONBOARDING_TEAM_CREATE_SUCCESS';
export const ONBOARDING_TEAM_CREATE_ERROR = 'ONBOARDING_TEAM_CREATE_ERROR';
export const ONBOARDING_TEAM_CREATE_CLEAR = 'ONBOARDING_TEAM_CREATE_CLEAR';

type ActionCreateTeamPending = {
  type: typeof ONBOARDING_TEAM_CREATE_PENDING;
};

type CreateTeamSuccessPayload = {
  slug: string;
  name: string;
  roles: Array<Role>;
};

type ActionTeamCreateSuccess = {
  type: typeof ONBOARDING_TEAM_CREATE_SUCCESS;
  payload: CreateTeamSuccessPayload;
};

type ActionCreateTeamError = {
  type: typeof ONBOARDING_TEAM_CREATE_ERROR;
  payload: { error: string };
};

type ActionCreateTeamErrorClear = {
  type: typeof ONBOARDING_TEAM_CREATE_CLEAR;
};

type OnboardingTeamCreateAction =
  | ActionCreateTeamPending
  | ActionTeamCreateSuccess
  | ActionCreateTeamError
  | ActionCreateTeamErrorClear;

type OnboardingTeamCreateState = {
  pending: boolean;
  error: string | null;
  data: CreateTeamSuccessPayload | null;
};

export type { OnboardingTeamCreateState, OnboardingTeamCreateAction };
