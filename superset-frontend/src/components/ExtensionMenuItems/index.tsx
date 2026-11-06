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
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useRef,
} from 'react';
import type { menus } from '@apache-superset/core';
import { logging } from '@apache-superset/core/utils';
import type { MenuItem } from '@superset-ui/core/components/Menu';
import { commands } from 'src/core/commands';
import { useMenu } from 'src/core/menus';

type ChartDownloadLocation = menus.ChartDownloadLocation;
type DashboardDownloadLocation = menus.DashboardDownloadLocation;
type ChartDownloadContext = menus.ChartDownloadContext;
type DashboardDownloadContext = menus.DashboardDownloadContext;

/**
 * Menu items for extension commands registered at `location`; empty when none.
 *
 * An extension must register its command before its menu item: `useMenu`
 * re-renders on menu changes, not command registration, so an item whose
 * command is not yet registered is skipped until the menu next re-renders.
 */
export function useExtensionMenuItems(
  location: ChartDownloadLocation | DashboardDownloadLocation,
  context: ChartDownloadContext | DashboardDownloadContext,
  options?: { onItemClick?: () => void; icon?: ReactNode },
): MenuItem[] {
  const menu = useMenu(location)?.primary;
  // Latest values are read at click time so items need not rebuild per render.
  const latest = useRef({ context, onItemClick: options?.onItemClick });
  latest.current = { context, onItemClick: options?.onItemClick };
  const { canDownload } = context;
  const icon = options?.icon;

  return useMemo(() => {
    const items: MenuItem[] = [];
    (menu ?? []).forEach(item => {
      const command = commands.getCommand(item.command);
      if (!command) {
        return;
      }
      items.push({
        key: `ext:${location}:${command.id}`,
        label: command.title,
        icon,
        disabled: !canDownload,
        onClick: () => {
          Promise.resolve(
            commands.executeCommand(item.command, latest.current.context),
          ).catch(error =>
            logging.error(`Extension command "${item.command}" failed`, error),
          );
          latest.current.onItemClick?.();
        },
      });
    });
    return items;
  }, [menu, canDownload, location, icon]);
}

const ChartDownloadItemsCtx = createContext<MenuItem[]>([]);

/** Resolves the extension items for `location` and supplies them to nested menus. */
export const ChartDownloadProvider: React.FC<{
  location: ChartDownloadLocation;
  context: ChartDownloadContext;
  /** Icon matching the menu's neighbouring export items. */
  icon?: ReactNode;
  children?: React.ReactNode;
}> = ({ location, context, icon, children }) => {
  const items = useExtensionMenuItems(location, context, { icon });
  return (
    <ChartDownloadItemsCtx.Provider value={items}>
      {children}
    </ChartDownloadItemsCtx.Provider>
  );
};

/** Extension items for the nearest {@link ChartDownloadProvider}; empty without one. */
export function useChartDownloadItems(): MenuItem[] {
  return useContext(ChartDownloadItemsCtx);
}
