import { FC, memo, useCallback, useMemo } from 'react';
import { Space, Typography } from 'antd';

import { styled, t } from '@superset-ui/core';
import CheckboxControl from '../../../../../explore/components/controls/CheckboxControl';
import { Role } from '../../../types';

const StyledSpace = styled(Space)`
  width: 100%;
  display: flex;
`;

type Props = {
  noTeam: boolean;
  existingTeam: boolean;
  isFranchisee: boolean;

  roles: Array<Role>;
  setRoles: (roles: Array<Role>) => void;
};

export const SelectRoles: FC<Props> = memo(
  ({ noTeam, existingTeam, isFranchisee, roles, setRoles }) => {
    const updateRoles = useCallback(
      (value: boolean, role: Role) => {
        let newRoles: Array<Role> = [];
        if (value) {
          newRoles = [...roles, role];
        } else {
          newRoles = roles.filter(item => item !== role);
        }

        setRoles(newRoles);
      },
      [roles, setRoles],
    );

    const roleList = useMemo(() => roles.join(', '), [roles]);

    return (
      <>
        <Typography.Title level={5}>
          {t('Which use cases are you interested in using Superset for?')}
        </Typography.Title>
        <StyledSpace direction="vertical" size="small">
          <CheckboxControl
            hovered
            label={t('readonly')}
            description={t(
              'Check available dashboards. Gather insights from charts inside a dashboard',
            )}
            value={roles.includes(Role.Readonly)}
            onChange={(value: boolean) => updateRoles(value, Role.Readonly)}
            disabled={noTeam || existingTeam}
          />
          <CheckboxControl
            hovered
            label={t('Create dashboards and charts')}
            description={t('Create dashboards. Create charts')}
            value={roles.includes(Role.VizualizeData)}
            onChange={(value: boolean) =>
              updateRoles(value, Role.VizualizeData)
            }
            disabled={noTeam || existingTeam}
          />
          <CheckboxControl
            hovered
            label={t('Create datasets and use SQL Lab')}
            description={t(
              'Create datasets. Use SQL Lab for your Ad-hoc queries',
            )}
            value={roles.includes(Role.CreateData)}
            onChange={(value: boolean) => updateRoles(value, Role.CreateData)}
            disabled={noTeam || existingTeam || isFranchisee}
          />
          <Typography.Text>
            {t('Based on your selection, your roles are:')}
          </Typography.Text>
          <Typography.Text strong underline>
            {roleList}
          </Typography.Text>
        </StyledSpace>
      </>
    );
  },
);
