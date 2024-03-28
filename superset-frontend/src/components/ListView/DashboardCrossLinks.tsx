import React, { useMemo } from 'react';
import { ensureIsArray } from '@superset-ui/core';
import { ChartLinkedDashboard } from 'src/types/Chart';
import CrossLinks from './CrossLinks';

export const DashboardCrossLinks = React.memo(
  ({ dashboards }: { dashboards: ChartLinkedDashboard[] }) => {
    const crossLinks = useMemo(
      () =>
        ensureIsArray(dashboards).map((d: ChartLinkedDashboard) => ({
          title: d.dashboard_title,
          id: d.id,
        })),
      [dashboards],
    );
    return <CrossLinks crossLinks={crossLinks} />;
  },
);
