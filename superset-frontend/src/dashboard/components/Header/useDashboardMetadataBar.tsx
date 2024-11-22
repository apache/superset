import { useMemo } from 'react';
import { t } from '@superset-ui/core';
import { DashboardInfo } from 'src/dashboard/types';
import MetadataBar, { MetadataType } from 'src/components/MetadataBar';
import getOwnerName from 'src/utils/getOwnerName';

export const useDashboardMetadataBar = (dashboardInfo: DashboardInfo) => {
  const items = useMemo(
    () => [
      {
        type: MetadataType.LastModified as const,
        value: dashboardInfo.changed_on_delta_humanized,
        modifiedBy:
          getOwnerName(dashboardInfo.changed_by) || t('Not available'),
      },
      {
        type: MetadataType.Owner as const,
        createdBy: getOwnerName(dashboardInfo.created_by) || t('Not available'),
        owners:
          dashboardInfo.owners.length > 0
            ? dashboardInfo.owners.map(getOwnerName)
            : t('None'),
        createdOn: dashboardInfo.created_on_delta_humanized,
      },
    ],
    [
      dashboardInfo.changed_by,
      dashboardInfo.changed_on_delta_humanized,
      dashboardInfo.created_by,
      dashboardInfo.created_on_delta_humanized,
      dashboardInfo.owners,
    ],
  );

  return <MetadataBar items={items} tooltipPlacement="bottom" />;
};
