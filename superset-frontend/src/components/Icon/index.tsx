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
import React, { SVGProps } from 'react';

import { ReactComponent as AlertIcon } from 'src/assets/images/icons/alert.svg';
import { ReactComponent as AlertSolidIcon } from 'src/assets/images/icons/alert_solid.svg';
import { ReactComponent as AlertSolidSmallIcon } from 'src/assets/images/icons/alert_solid_small.svg';
import { ReactComponent as BinocularsIcon } from 'src/assets/images/icons/binoculars.svg';
import { ReactComponent as BoltIcon } from 'src/assets/images/icons/bolt.svg';
import { ReactComponent as BoltSmallIcon } from 'src/assets/images/icons/bolt_small.svg';
import { ReactComponent as CrossFilterBadge } from 'src/assets/images/icons/cross-filter-badge.svg';
import { ReactComponent as BoltSmallRunIcon } from 'src/assets/images/icons/bolt_small_run.svg';
import { ReactComponent as CalendarIcon } from 'src/assets/images/icons/calendar.svg';
import { ReactComponent as CancelIcon } from 'src/assets/images/icons/cancel.svg';
import { ReactComponent as CancelSolidIcon } from 'src/assets/images/icons/cancel_solid.svg';
import { ReactComponent as CancelXIcon } from 'src/assets/images/icons/cancel-x.svg';
import { ReactComponent as CardViewIcon } from 'src/assets/images/icons/card_view.svg';
import { ReactComponent as CardsIcon } from 'src/assets/images/icons/cards.svg';
import { ReactComponent as CardsLockedIcon } from 'src/assets/images/icons/cards_locked.svg';
import { ReactComponent as CaretDownIcon } from 'src/assets/images/icons/caret_down.svg';
import { ReactComponent as CaretLeftIcon } from 'src/assets/images/icons/caret_left.svg';
import { ReactComponent as CaretRightIcon } from 'src/assets/images/icons/caret_right.svg';
import { ReactComponent as CaretUpIcon } from 'src/assets/images/icons/caret_up.svg';
import { ReactComponent as CertifiedIcon } from 'src/assets/images/icons/certified.svg';
import { ReactComponent as CheckIcon } from 'src/assets/images/icons/check.svg';
import { ReactComponent as CheckboxHalfIcon } from 'src/assets/images/icons/checkbox-half.svg';
import { ReactComponent as CheckboxOffIcon } from 'src/assets/images/icons/checkbox-off.svg';
import { ReactComponent as CheckboxOnIcon } from 'src/assets/images/icons/checkbox-on.svg';
import { ReactComponent as CircleCheckIcon } from 'src/assets/images/icons/circle_check.svg';
import { ReactComponent as CircleCheckSolidIcon } from 'src/assets/images/icons/circle_check_solid.svg';
import { ReactComponent as CircleIcon } from 'src/assets/images/icons/circle.svg';
import { ReactComponent as ClockIcon } from 'src/assets/images/icons/clock.svg';
import { ReactComponent as CloseIcon } from 'src/assets/images/icons/close.svg';
import { ReactComponent as CodeIcon } from 'src/assets/images/icons/code.svg';
import { ReactComponent as CogIcon } from 'src/assets/images/icons/cog.svg';
import { ReactComponent as CollapseIcon } from 'src/assets/images/icons/collapse.svg';
import { ReactComponent as ColorPaletteIcon } from 'src/assets/images/icons/color_palette.svg';
import { ReactComponent as ComponentsIcon } from 'src/assets/images/icons/components.svg';
import { ReactComponent as CopyIcon } from 'src/assets/images/icons/copy.svg';
import { ReactComponent as CursorTargeIcon } from 'src/assets/images/icons/cursor_target.svg';
import { ReactComponent as DatabaseIcon } from 'src/assets/images/icons/database.svg';
import { ReactComponent as DatasetPhysicalIcon } from 'src/assets/images/icons/dataset_physical.svg';
import { ReactComponent as DatasetVirtualGreyscaleIcon } from 'src/assets/images/icons/dataset_virtual_greyscale.svg';
import { ReactComponent as DatasetVirtualIcon } from 'src/assets/images/icons/dataset_virtual.svg';
import { ReactComponent as DownloadIcon } from 'src/assets/images/icons/download.svg';
import { ReactComponent as EditAltIcon } from 'src/assets/images/icons/edit_alt.svg';
import { ReactComponent as EditIcon } from 'src/assets/images/icons/edit.svg';
import { ReactComponent as EmailIcon } from 'src/assets/images/icons/email.svg';
import { ReactComponent as ErrorIcon } from 'src/assets/images/icons/error.svg';
import { ReactComponent as ErrorSolidIcon } from 'src/assets/images/icons/error_solid.svg';
import { ReactComponent as ErrorSolidSmallIcon } from 'src/assets/images/icons/error_solid_small.svg';
import { ReactComponent as ExclamationIcon } from 'src/assets/images/icons/exclamation.svg';
import { ReactComponent as ExpandIcon } from 'src/assets/images/icons/expand.svg';
import { ReactComponent as EyeIcon } from 'src/assets/images/icons/eye.svg';
import { ReactComponent as EyeSlashIcon } from 'src/assets/images/icons/eye_slash.svg';
import { ReactComponent as FavoriteSelectedIcon } from 'src/assets/images/icons/favorite-selected.svg';
import { ReactComponent as FavoriteSmallSelectedIcon } from 'src/assets/images/icons/favorite_small_selected.svg';
import { ReactComponent as FavoriteUnselectedIcon } from 'src/assets/images/icons/favorite-unselected.svg';
import { ReactComponent as FieldABCIcon } from 'src/assets/images/icons/field_abc.svg';
import { ReactComponent as FieldBooleanIcon } from 'src/assets/images/icons/field_boolean.svg';
import { ReactComponent as FieldDateIcon } from 'src/assets/images/icons/field_date.svg';
import { ReactComponent as FieldDerivedIcon } from 'src/assets/images/icons/field_derived.svg';
import { ReactComponent as FieldNumIcon } from 'src/assets/images/icons/field_num.svg';
import { ReactComponent as FieldStructIcon } from 'src/assets/images/icons/field_struct.svg';
import { ReactComponent as FileIcon } from 'src/assets/images/icons/file.svg';
import { ReactComponent as FilterIcon } from 'src/assets/images/icons/filter.svg';
import { ReactComponent as FilterSmallIcon } from 'src/assets/images/icons/filter_small.svg';
import { ReactComponent as FolderIcon } from 'src/assets/images/icons/folder.svg';
import { ReactComponent as FullIcon } from 'src/assets/images/icons/full.svg';
import { ReactComponent as FunctionIcon } from 'src/assets/images/icons/function_x.svg';
import { ReactComponent as GearIcon } from 'src/assets/images/icons/gear.svg';
import { ReactComponent as GridIcon } from 'src/assets/images/icons/grid.svg';
import { ReactComponent as ImageIcon } from 'src/assets/images/icons/image.svg';
import { ReactComponent as ImportIcon } from 'src/assets/images/icons/import.svg';
import { ReactComponent as InfoIcon } from 'src/assets/images/icons/info.svg';
import { ReactComponent as InfoSolidIcon } from 'src/assets/images/icons/info-solid.svg';
import { ReactComponent as InfoSolidSmallIcon } from 'src/assets/images/icons/info_solid_small.svg';
import { ReactComponent as JoinIcon } from 'src/assets/images/icons/join.svg';
import { ReactComponent as KeyboardIcon } from 'src/assets/images/icons/keyboard.svg';
import { ReactComponent as LayersIcon } from 'src/assets/images/icons/layers.svg';
import { ReactComponent as LightbulbIcon } from 'src/assets/images/icons/lightbulb.svg';
import { ReactComponent as LinkIcon } from 'src/assets/images/icons/link.svg';
import { ReactComponent as ListIcon } from 'src/assets/images/icons/list.svg';
import { ReactComponent as ListViewIcon } from 'src/assets/images/icons/list_view.svg';
import { ReactComponent as LocationIcon } from 'src/assets/images/icons/location.svg';
import { ReactComponent as LockLockedIcon } from 'src/assets/images/icons/lock_locked.svg';
import { ReactComponent as LockUnlockedIcon } from 'src/assets/images/icons/lock_unlocked.svg';
import { ReactComponent as MapIcon } from 'src/assets/images/icons/map.svg';
import { ReactComponent as MessageIcon } from 'src/assets/images/icons/message.svg';
import { ReactComponent as MinusIcon } from 'src/assets/images/icons/minus.svg';
import { ReactComponent as MinusSolidIcon } from 'src/assets/images/icons/minus_solid.svg';
import { ReactComponent as MoreHorizIcon } from 'src/assets/images/icons/more_horiz.svg';
import { ReactComponent as MoveIcon } from 'src/assets/images/icons/move.svg';
import { ReactComponent as NavChartsIcon } from 'src/assets/images/icons/nav_charts.svg';
import { ReactComponent as NavDashboardIcon } from 'src/assets/images/icons/nav_dashboard.svg';
import { ReactComponent as NavDataIcon } from 'src/assets/images/icons/nav_data.svg';
import { ReactComponent as NavExploreIcon } from 'src/assets/images/icons/nav_explore.svg';
import { ReactComponent as NavHomeIcon } from 'src/assets/images/icons/nav_home.svg';
import { ReactComponent as NavLabIcon } from 'src/assets/images/icons/nav_lab.svg';
import { ReactComponent as NoteIcon } from 'src/assets/images/icons/note.svg';
import { ReactComponent as OfflineIcon } from 'src/assets/images/icons/offline.svg';
import { ReactComponent as PaperclipIcon } from 'src/assets/images/icons/paperclip.svg';
import { ReactComponent as PlaceholderIcon } from 'src/assets/images/icons/placeholder.svg';
import { ReactComponent as PlusIcon } from 'src/assets/images/icons/plus.svg';
import { ReactComponent as PlusLargeIcon } from 'src/assets/images/icons/plus_large.svg';
import { ReactComponent as PlusSmallIcon } from 'src/assets/images/icons/plus_small.svg';
import { ReactComponent as PlusSolidIcon } from 'src/assets/images/icons/plus_solid.svg';
import { ReactComponent as QueuedIcon } from 'src/assets/images/icons/queued.svg';
import { ReactComponent as RefreshIcon } from 'src/assets/images/icons/refresh.svg';
import { ReactComponent as RunningIcon } from 'src/assets/images/icons/running.svg';
import { ReactComponent as SaveIcon } from 'src/assets/images/icons/save.svg';
import { ReactComponent as SQLIcon } from 'src/assets/images/icons/sql.svg';
import { ReactComponent as SearchIcon } from 'src/assets/images/icons/search.svg';
import { ReactComponent as ServerIcon } from 'src/assets/images/icons/server.svg';
import { ReactComponent as ShareIcon } from 'src/assets/images/icons/share.svg';
import { ReactComponent as SlackIcon } from 'src/assets/images/icons/slack.svg';
import { ReactComponent as SortAscIcon } from 'src/assets/images/icons/sort_asc.svg';
import { ReactComponent as SortDescIcon } from 'src/assets/images/icons/sort_desc.svg';
import { ReactComponent as SortIcon } from 'src/assets/images/icons/sort.svg';
import { ReactComponent as TableIcon } from 'src/assets/images/icons/table.svg';
import { ReactComponent as TagIcon } from 'src/assets/images/icons/tag.svg';
import { ReactComponent as TrashIcon } from 'src/assets/images/icons/trash.svg';
import { ReactComponent as TriangleChangeIcon } from 'src/assets/images/icons/triangle_change.svg';
import { ReactComponent as TriangleDownIcon } from 'src/assets/images/icons/triangle_down.svg';
import { ReactComponent as TriangleUpIcon } from 'src/assets/images/icons/triangle_up.svg';
import { ReactComponent as UpLevelIcon } from 'src/assets/images/icons/up-level.svg';
import { ReactComponent as UserIcon } from 'src/assets/images/icons/user.svg';
import { ReactComponent as WarningIcon } from 'src/assets/images/icons/warning.svg';
import { ReactComponent as WarningSolidIcon } from 'src/assets/images/icons/warning_solid.svg';
import { ReactComponent as XLargeIcon } from 'src/assets/images/icons/x-large.svg';
import { ReactComponent as XSmallIcon } from 'src/assets/images/icons/x-small.svg';

export type IconName =
  | 'alert'
  | 'alert-solid'
  | 'alert-solid-small'
  | 'binoculars'
  | 'bolt'
  | 'bolt-small'
  | 'bolt-small-run'
  | 'calendar'
  | 'cancel'
  | 'cancel-solid'
  | 'cancel-x'
  | 'card-view'
  | 'cards'
  | 'cards-locked'
  | 'caret-down'
  | 'caret-left'
  | 'caret-right'
  | 'caret-up'
  | 'certified'
  | 'cross-filter-badge'
  | 'check'
  | 'checkbox-half'
  | 'checkbox-off'
  | 'checkbox-on'
  | 'circle'
  | 'circle-check'
  | 'circle-check-solid'
  | 'clock'
  | 'close'
  | 'code'
  | 'cog'
  | 'collapse'
  | 'color-palette'
  | 'components'
  | 'copy'
  | 'cursor-target'
  | 'database'
  | 'dataset-physical'
  | 'dataset-virtual'
  | 'dataset-virtual-greyscale'
  | 'download'
  | 'edit'
  | 'edit-alt'
  | 'email'
  | 'error'
  | 'error-solid'
  | 'error-solid-small'
  | 'exclamation'
  | 'expand'
  | 'eye'
  | 'eye-slash'
  | 'favorite-selected'
  | 'favorite-small-selected'
  | 'favorite-unselected'
  | 'field-abc'
  | 'field-boolean'
  | 'field-date'
  | 'field-derived'
  | 'field-num'
  | 'field-struct'
  | 'file'
  | 'filter'
  | 'filter-small'
  | 'folder'
  | 'full'
  | 'function'
  | 'gear'
  | 'grid'
  | 'image'
  | 'import'
  | 'info'
  | 'info-solid'
  | 'info-solid-small'
  | 'join'
  | 'keyboard'
  | 'layers'
  | 'link'
  | 'lightbulb'
  | 'list'
  | 'list-view'
  | 'location'
  | 'lock-locked'
  | 'lock-unlocked'
  | 'map'
  | 'message'
  | 'minus'
  | 'minus-solid'
  | 'more-horiz'
  | 'move'
  | 'nav-charts'
  | 'nav-dashboard'
  | 'nav-data'
  | 'nav-explore'
  | 'nav-home'
  | 'nav-lab'
  | 'note'
  | 'offline'
  | 'paperclip'
  | 'placeholder'
  | 'plus'
  | 'plus-large'
  | 'plus-small'
  | 'plus-solid'
  | 'queued'
  | 'refresh'
  | 'running'
  | 'save'
  | 'search'
  | 'server'
  | 'share'
  | 'slack'
  | 'sort'
  | 'sort-asc'
  | 'sort-desc'
  | 'sql'
  | 'table'
  | 'tag'
  | 'trash'
  | 'triangle-change'
  | 'triangle-down'
  | 'triangle-up'
  | 'up-level'
  | 'user'
  | 'warning'
  | 'warning-solid'
  | 'x-large'
  | 'x-small';

export const iconsRegistry: Record<
  IconName,
  React.ComponentType<SVGProps<SVGSVGElement>>
> = {
  'alert-solid': AlertSolidIcon,
  'alert-solid-small': AlertSolidSmallIcon,
  'bolt-small': BoltSmallIcon,
  'bolt-small-run': BoltSmallRunIcon,
  'cross-filter-badge': CrossFilterBadge,
  'cancel-solid': CancelSolidIcon,
  'cancel-x': CancelXIcon,
  'card-view': CardViewIcon,
  'cards-locked': CardsLockedIcon,
  'caret-down': CaretDownIcon,
  'caret-left': CaretLeftIcon,
  'caret-right': CaretRightIcon,
  'caret-up': CaretUpIcon,
  'checkbox-half': CheckboxHalfIcon,
  'checkbox-off': CheckboxOffIcon,
  'checkbox-on': CheckboxOnIcon,
  'circle-check': CircleCheckIcon,
  'circle-check-solid': CircleCheckSolidIcon,
  'color-palette': ColorPaletteIcon,
  'cursor-target': CursorTargeIcon,
  'dataset-physical': DatasetPhysicalIcon,
  'dataset-virtual': DatasetVirtualIcon,
  'dataset-virtual-greyscale': DatasetVirtualGreyscaleIcon,
  'edit-alt': EditAltIcon,
  'error-solid': ErrorSolidIcon,
  'error-solid-small': ErrorSolidSmallIcon,
  'eye-slash': EyeSlashIcon,
  'favorite-selected': FavoriteSelectedIcon,
  'favorite-small-selected': FavoriteSmallSelectedIcon,
  'favorite-unselected': FavoriteUnselectedIcon,
  'field-abc': FieldABCIcon,
  'field-boolean': FieldBooleanIcon,
  'field-date': FieldDateIcon,
  'field-derived': FieldDerivedIcon,
  'field-num': FieldNumIcon,
  'field-struct': FieldStructIcon,
  'filter-small': FilterSmallIcon,
  'info-solid': InfoSolidIcon,
  'info-solid-small': InfoSolidSmallIcon,
  'list-view': ListViewIcon,
  'lock-locked': LockLockedIcon,
  'lock-unlocked': LockUnlockedIcon,
  'minus-solid': MinusSolidIcon,
  'more-horiz': MoreHorizIcon,
  'nav-charts': NavChartsIcon,
  'nav-dashboard': NavDashboardIcon,
  'nav-data': NavDataIcon,
  'nav-explore': NavExploreIcon,
  'nav-home': NavHomeIcon,
  'nav-lab': NavLabIcon,
  'plus-large': PlusLargeIcon,
  'plus-small': PlusSmallIcon,
  'plus-solid': PlusSolidIcon,
  'sort-asc': SortAscIcon,
  'sort-desc': SortDescIcon,
  'triangle-change': TriangleChangeIcon,
  'triangle-down': TriangleDownIcon,
  'triangle-up': TriangleUpIcon,
  'up-level': UpLevelIcon,
  'warning-solid': WarningSolidIcon,
  'x-large': XLargeIcon,
  'x-small': XSmallIcon,
  alert: AlertIcon,
  binoculars: BinocularsIcon,
  bolt: BoltIcon,
  calendar: CalendarIcon,
  cancel: CancelIcon,
  cards: CardsIcon,
  certified: CertifiedIcon,
  check: CheckIcon,
  circle: CircleIcon,
  clock: ClockIcon,
  close: CloseIcon,
  code: CodeIcon,
  cog: CogIcon,
  collapse: CollapseIcon,
  components: ComponentsIcon,
  copy: CopyIcon,
  database: DatabaseIcon,
  download: DownloadIcon,
  edit: EditIcon,
  email: EmailIcon,
  error: ErrorIcon,
  exclamation: ExclamationIcon,
  expand: ExpandIcon,
  eye: EyeIcon,
  file: FileIcon,
  filter: FilterIcon,
  folder: FolderIcon,
  full: FullIcon,
  function: FunctionIcon,
  gear: GearIcon,
  grid: GridIcon,
  image: ImageIcon,
  import: ImportIcon,
  info: InfoIcon,
  join: JoinIcon,
  keyboard: KeyboardIcon,
  layers: LayersIcon,
  link: LinkIcon,
  lightbulb: LightbulbIcon,
  list: ListIcon,
  location: LocationIcon,
  map: MapIcon,
  message: MessageIcon,
  minus: MinusIcon,
  move: MoveIcon,
  note: NoteIcon,
  offline: OfflineIcon,
  paperclip: PaperclipIcon,
  placeholder: PlaceholderIcon,
  plus: PlusIcon,
  queued: QueuedIcon,
  refresh: RefreshIcon,
  running: RunningIcon,
  save: SaveIcon,
  search: SearchIcon,
  server: ServerIcon,
  share: ShareIcon,
  slack: SlackIcon,
  sort: SortIcon,
  sql: SQLIcon,
  table: TableIcon,
  tag: TagIcon,
  trash: TrashIcon,
  user: UserIcon,
  warning: WarningIcon,
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  'data-test'?: string;
}

const Icon = ({
  name,
  color = '#666666',
  viewBox = '0 0 24 24',
  'data-test': dataTest,
  ...rest
}: IconProps) => {
  const Component = iconsRegistry[name];

  return (
    <Component
      role="img"
      aria-label={name}
      color={color}
      viewBox={viewBox}
      data-test={dataTest ?? name}
      {...rest}
    />
  );
};

export default Icon;
