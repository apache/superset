import { UserRoles } from '../../../../types/bootstrapTypes';

export const getUserInfo = (state: { user: { roles: UserRoles } }) =>
  state.user;
