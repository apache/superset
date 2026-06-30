/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useCallback, useState } from 'react';
import {
  useSaveFilterConfiguration,
  useSaveChartCustomization,
} from 'src/dashboard/queries';
import { SaveChangesType } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/types';
import FiltersConfigModal from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigModal';

interface UseFilterConfigModalProps {
  createNewOnOpen?: boolean;
  dashboardId: number;
  initialFilterId?: string;
}

interface UseFilterConfigModalReturn {
  isFilterConfigModalOpen: boolean;
  openFilterConfigModal: () => void;
  closeFilterConfigModal: () => void;
  handleSave: (changes: SaveChangesType) => Promise<void>;
  FilterConfigModalComponent: JSX.Element | null;
}

export const useFilterConfigModal = ({
  createNewOnOpen = false,
  dashboardId,
  initialFilterId,
}: UseFilterConfigModalProps): UseFilterConfigModalReturn => {
  const { mutateAsync: saveFilterConfiguration } = useSaveFilterConfiguration();
  const { mutateAsync: saveChartCustomization } = useSaveChartCustomization();
  const [isFilterConfigModalOpen, setIsFilterConfigModalOpen] = useState(false);

  const openFilterConfigModal = useCallback(() => {
    setIsFilterConfigModalOpen(true);
  }, []);

  const closeFilterConfigModal = useCallback(() => {
    setIsFilterConfigModalOpen(false);
  }, []);

  const handleSave = useCallback(
    async (changes: SaveChangesType) => {
      try {
        if (changes.filterChanges) {
          await saveFilterConfiguration(changes.filterChanges);
        }
        if (changes.customizationChanges) {
          await saveChartCustomization({
            modifiedCustomizations: changes.customizationChanges.modified,
            deletedIds: changes.customizationChanges.deleted,
            reorderedIds: changes.customizationChanges.reordered,
            resetDataMask: true,
          });
        }
        closeFilterConfigModal();
      } catch (error) {
        // Error toast already shown in hook; keep the modal open so edits aren't lost.
      }
    },
    [saveFilterConfiguration, saveChartCustomization, closeFilterConfigModal],
  );

  const FilterConfigModalComponent = isFilterConfigModalOpen ? (
    <FiltersConfigModal
      isOpen={isFilterConfigModalOpen}
      onSave={handleSave}
      onCancel={closeFilterConfigModal}
      key={`filters-for-${dashboardId}`}
      createNewOnOpen={createNewOnOpen}
      initialFilterId={initialFilterId}
    />
  ) : null;

  return {
    isFilterConfigModalOpen,
    openFilterConfigModal,
    closeFilterConfigModal,
    handleSave,
    FilterConfigModalComponent,
  };
};
