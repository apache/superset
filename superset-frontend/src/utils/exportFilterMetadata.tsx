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
import { t } from '@apache-superset/core/translation';
import type { MenuItem } from '@superset-ui/core/components/Menu';
import { MenuItemTooltip } from 'src/components/Chart/DisabledMenuItemTooltip';

/**
 * How a chart data export includes the filters applied to the chart. Sent to
 * `/api/v1/chart/data` as the request's top-level `filter_metadata` field.
 */
export enum FilterMetadata {
  None = 'none',
  Separate = 'separate',
}

const FILTER_METADATA_VALUES = new Set<string>(Object.values(FilterMetadata));

/**
 * Narrow an unknown value to a filter metadata option. Menu handlers are
 * sometimes wired straight to `onClick`, which passes an event object, so
 * anything that is not a known option counts as no filter metadata.
 */
export const toFilterMetadata = (value: unknown): FilterMetadata =>
  typeof value === 'string' && FILTER_METADATA_VALUES.has(value)
    ? (value as FilterMetadata)
    : FilterMetadata.None;

export const getFilterMetadataLabel = (option: FilterMetadata): string =>
  option === FilterMetadata.Separate
    ? t('Include filters as a separate file')
    : t('Without filter metadata');

interface CsvFilterMetadataItemsOptions {
  /** Prefix for the item keys, so each menu keeps its keys unique. */
  keyPrefix: string;
  onSelect: (option: FilterMetadata) => void;
  /**
   * Grey out the separate file choice, because a CSV that streams cannot be
   * packed into a ZIP with a filters file.
   */
  separateDisabled?: boolean;
}

/**
 * The submenu items offered under a CSV export.
 */
export const getCsvFilterMetadataItems = ({
  keyPrefix,
  onSelect,
  separateDisabled = false,
}: CsvFilterMetadataItemsOptions): MenuItem[] =>
  Object.values(FilterMetadata).map(option => {
    const label = getFilterMetadataLabel(option);
    const disabled = option === FilterMetadata.Separate && separateDisabled;
    return {
      key: `${keyPrefix}-${option}`,
      disabled,
      label: disabled ? (
        <span>
          {label}
          <MenuItemTooltip
            title={t(
              'This export is too large to include a separate filters file.',
            )}
          />
        </span>
      ) : (
        label
      ),
      onClick: () => onSelect(option),
    };
  });
