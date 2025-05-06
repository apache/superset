import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';
import ChartCustomizationModal from './ChartCustomizationModal';

export const useChartCustomizationModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dashboardId = useSelector<RootState, number>(
    state => state.dashboardInfo.id,
  );

  const openChartCustomizationModal = () => setIsOpen(true);
  const closeChartCustomizationModal = () => setIsOpen(false);

  const ChartCustomizationModalComponent = useMemo(
    () =>
      isOpen ? (
        <ChartCustomizationModal
          isOpen={isOpen}
          dashboardId={dashboardId}
          onCancel={closeChartCustomizationModal}
          onSave={() => {
            closeChartCustomizationModal();
          }}
        />
      ) : null,
    [isOpen, dashboardId],
  );

  return { openChartCustomizationModal, ChartCustomizationModalComponent };
};
