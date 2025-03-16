import { SingleStatementDto } from './singleStatement.dto';
import { SingleStatementModel } from '../model/types/request.types';
import { UserFromEnum } from '../types';

export const singleStatementFactory = (
  dto: SingleStatementDto,
): SingleStatementModel => ({
  userFrom: dto.result.is_external
    ? UserFromEnum.Franchisee
    : UserFromEnum.ManagingCompany,
  firstName: dto.result.user.at(0)?.first_name ?? '',
  lastName: dto.result.user.at(0)?.last_name ?? '',
  email: dto.result.user.at(0)?.email ?? '',
  dodoRole: dto.result.dodo_role,
  currentRoles: dto.result.user.at(0)?.roles.map(role => role.name) ?? [],
  requestedRoles: dto.result.request_roles,
  team: `${dto.result.team} (${dto.result.team_slug})`,
  requestDate: new Date(
    dto.result.created_datetime.includes('Z')
      ? dto.result.created_datetime
      : `${dto.result.created_datetime}Z`,
  ),
  isClosed: dto.result.finished,
  updateDate: new Date(
    dto.result.last_changed_datetime.includes('Z')
      ? dto.result.last_changed_datetime
      : `${dto.result.last_changed_datetime}Z`,
  ),
});
