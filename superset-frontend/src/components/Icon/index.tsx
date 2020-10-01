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

import { ReactComponent as AlertSolidIcon } from 'images/icons/alert_solid.svg';
import { ReactComponent as AlertIcon } from 'images/icons/alert.svg';
import { ReactComponent as BinocularsIcon } from 'images/icons/binoculars.svg';
import { ReactComponent as BoltSmallRunIcon } from 'images/icons/bolt_small_run.svg';
import { ReactComponent as BoltSmallIcon } from 'images/icons/bolt_small.svg';
import { ReactComponent as BoltIcon } from 'images/icons/bolt.svg';
import { ReactComponent as CalendarIcon } from 'images/icons/calendar.svg';
import { ReactComponent as CancelSolidIcon } from 'images/icons/cancel_solid.svg';
import { ReactComponent as CancelXIcon } from 'images/icons/cancel-x.svg';
import { ReactComponent as CancelIcon } from 'images/icons/cancel.svg';
import { ReactComponent as CardViewIcon } from 'images/icons/card_view.svg';
import { ReactComponent as CardsLockedIcon } from 'images/icons/cards_locked.svg';
import { ReactComponent as CardsIcon } from 'images/icons/cards.svg';
import { ReactComponent as CaretDownIcon } from 'images/icons/caret_down.svg';
import { ReactComponent as CaretLeftIcon } from 'images/icons/caret_left.svg';
import { ReactComponent as CaretRightIcon } from 'images/icons/caret_right.svg';
import { ReactComponent as CaretUpIcon } from 'images/icons/caret_up.svg';
import { ReactComponent as CertifiedIcon } from 'images/icons/certified.svg';
import { ReactComponent as CheckIcon } from 'images/icons/check.svg';
import { ReactComponent as CheckboxHalfIcon } from 'images/icons/checkbox-half.svg';
import { ReactComponent as CheckboxOffIcon } from 'images/icons/checkbox-off.svg';
import { ReactComponent as CheckboxOnIcon } from 'images/icons/checkbox-on.svg';
import { ReactComponent as CircleCheckSolidIcon } from 'images/icons/circle_check_solid.svg';
import { ReactComponent as CircleCheckIcon } from 'images/icons/circle_check.svg';
import { ReactComponent as CircleIcon } from 'images/icons/circle.svg';
import { ReactComponent as ClockIcon } from 'images/icons/clock.svg';
import { ReactComponent as CloseIcon } from 'images/icons/close.svg';
import { ReactComponent as CodeIcon } from 'images/icons/code.svg';
import { ReactComponent as CogIcon } from 'images/icons/cog.svg';
import { ReactComponent as CollapseIcon } from 'images/icons/collapse.svg';
import { ReactComponent as ColorPaletteIcon } from 'images/icons/color_palette.svg';
import { ReactComponent as ComponentsIcon } from 'images/icons/components.svg';
import { ReactComponent as CopyIcon } from 'images/icons/copy.svg';
import { ReactComponent as CursorTargeIcon } from 'images/icons/cursor_target.svg';
import { ReactComponent as DatabaseIcon } from 'images/icons/database.svg';
import { ReactComponent as DatasetPhysicalIcon } from 'images/icons/dataset_physical.svg';
import { ReactComponent as DatasetVirtualGreyscaleIcon } from 'images/icons/dataset_virtual_greyscale.svg';
import { ReactComponent as DatasetVirtualIcon } from 'images/icons/dataset_virtual.svg';
import { ReactComponent as DownloadIcon } from 'images/icons/download.svg';
import { ReactComponent as EditAltIcon } from 'images/icons/edit_alt.svg';
import { ReactComponent as EditIcon } from 'images/icons/edit.svg';
import { ReactComponent as EmailIcon } from 'images/icons/email.svg';
import { ReactComponent as ErrorSolidSmallIcon } from 'images/icons/error_solid_small.svg';
import { ReactComponent as ErrorSolidIcon } from 'images/icons/error_solid.svg';
import { ReactComponent as ErrorIcon } from 'images/icons/error.svg';
import { ReactComponent as ExpandIcon } from 'images/icons/expand.svg';
import { ReactComponent as EyeSlashIcon } from 'images/icons/eye_slash.svg';
import { ReactComponent as EyeIcon } from 'images/icons/eye.svg';
import { ReactComponent as FavoriteSmallSelectedIcon } from 'images/icons/favorite_small_selected.svg';
import { ReactComponent as FavoriteSelectedIcon } from 'images/icons/favorite-selected.svg';
import { ReactComponent as FavoriteUnselectedIcon } from 'images/icons/favorite-unselected.svg';
import { ReactComponent as FieldABCIcon } from 'images/icons/field_abc.svg';
import { ReactComponent as FieldBooleanIcon } from 'images/icons/field_boolean.svg';
import { ReactComponent as FieldDateIcon } from 'images/icons/field_date.svg';
import { ReactComponent as FieldDerivedIcon } from 'images/icons/field_derived.svg';
import { ReactComponent as FieldNumIcon } from 'images/icons/field_num.svg';
import { ReactComponent as FieldStructIcon } from 'images/icons/field_struct.svg';
import { ReactComponent as FileIcon } from 'images/icons/file.svg';
import { ReactComponent as FilterIcon } from 'images/icons/filter.svg';
import { ReactComponent as FolderIcon } from 'images/icons/folder.svg';
import { ReactComponent as FullIcon } from 'images/icons/full.svg';
import { ReactComponent as GearIcon } from 'images/icons/gear.svg';
import { ReactComponent as GridIcon } from 'images/icons/grid.svg';
import { ReactComponent as ImageIcon } from 'images/icons/image.svg';
import { ReactComponent as InfoSolidSmallIcon } from 'images/icons/info_solid_small.svg';
import { ReactComponent as InfoSolidIcon } from 'images/icons/info-solid.svg';
import { ReactComponent as InfoIcon } from 'images/icons/info.svg';
import { ReactComponent as JoinIcon } from 'images/icons/join.svg';
import { ReactComponent as KeyboardIcon } from 'images/icons/keyboard.svg';
import { ReactComponent as LayersIcon } from 'images/icons/layers.svg';
import { ReactComponent as LightbulbIcon } from 'images/icons/lightbulb.svg';
import { ReactComponent as ListViewIcon } from 'images/icons/list_view.svg';
import { ReactComponent as ListIcon } from 'images/icons/list.svg';
import { ReactComponent as LocationIcon } from 'images/icons/location.svg';
import { ReactComponent as LockLockedIcon } from 'images/icons/lock_locked.svg';
import { ReactComponent as LockUnlockedIcon } from 'images/icons/lock_unlocked.svg';
import { ReactComponent as MapIcon } from 'images/icons/map.svg';
import { ReactComponent as MessageIcon } from 'images/icons/message.svg';
import { ReactComponent as MinusSolidIcon } from 'images/icons/minus_solid.svg';
import { ReactComponent as MinusIcon } from 'images/icons/minus.svg';
import { ReactComponent as MoreHorizIcon } from 'images/icons/more_horiz.svg';
import { ReactComponent as MoveIcon } from 'images/icons/move.svg';
import { ReactComponent as NavChartsIcon } from 'images/icons/nav_charts.svg';
import { ReactComponent as NavDashboardIcon } from 'images/icons/nav_dashboard.svg';
import { ReactComponent as NavDataIcon } from 'images/icons/nav_data.svg';
import { ReactComponent as NavExploreIcon } from 'images/icons/nav_explore.svg';
import { ReactComponent as NavHomeIcon } from 'images/icons/nav_home.svg';
import { ReactComponent as NavLabIcon } from 'images/icons/nav_lab.svg';
import { ReactComponent as NoteIcon } from 'images/icons/note.svg';
import { ReactComponent as PaperclipIcon } from 'images/icons/paperclip.svg';
import { ReactComponent as PlaceholderIcon } from 'images/icons/placeholder.svg';
import { ReactComponent as PlusLargeIcon } from 'images/icons/plus_large.svg';
import { ReactComponent as PlusSmallIcon } from 'images/icons/plus_small.svg';
import { ReactComponent as PlusSolidIcon } from 'images/icons/plus_solid.svg';
import { ReactComponent as PlusIcon } from 'images/icons/plus.svg';
import { ReactComponent as RefreshIcon } from 'images/icons/refresh.svg';
import { ReactComponent as SearchIcon } from 'images/icons/search.svg';
import { ReactComponent as ServerIcon } from 'images/icons/server.svg';
import { ReactComponent as ShareIcon } from 'images/icons/share.svg';
import { ReactComponent as SortAscIcon } from 'images/icons/sort_asc.svg';
import { ReactComponent as SortDescIcon } from 'images/icons/sort_desc.svg';
import { ReactComponent as SortIcon } from 'images/icons/sort.svg';
import { ReactComponent as SQLIcon } from 'images/icons/sql.svg';
import { ReactComponent as TableIcon } from 'images/icons/table.svg';
import { ReactComponent as TagIcon } from 'images/icons/tag.svg';
import { ReactComponent as TrashIcon } from 'images/icons/trash.svg';
import { ReactComponent as TriangleChangeIcon } from 'images/icons/triangle_change.svg';
import { ReactComponent as TriangleDownIcon } from 'images/icons/triangle_down.svg';
import { ReactComponent as TriangleUpIcon } from 'images/icons/triangle_up.svg';
import { ReactComponent as UpLevelIcon } from 'images/icons/up-level.svg';
import { ReactComponent as UserIcon } from 'images/icons/user.svg';
import { ReactComponent as WarningSolidIcon } from 'images/icons/warning_solid.svg';
import { ReactComponent as WarningIcon } from 'images/icons/warning.svg';
import { ReactComponent as XLargeIcon } from 'images/icons/x-large.svg';
import { ReactComponent as XSmallIcon } from 'images/icons/x-small.svg';

export type IconName =
  | 'alert-solid'
  | 'alert'
  | 'binoculars'
  | 'bolt-small-run'
  | 'bolt-small'
  | 'bolt'
  | 'calendar'
  | 'cancel-solid'
  | 'cancel-x'
  | 'cancel'
  | 'card-view'
  | 'cards-locked'
  | 'cards'
  | 'caret-down'
  | 'caret-left'
  | 'caret-right'
  | 'caret-up'
  | 'certified'
  | 'check'
  | 'checkbox-half'
  | 'checkbox-off'
  | 'checkbox-on'
  | 'circle-check-solid'
  | 'circle-check'
  | 'circle'
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
  | 'dataset-virtual-greyscale'
  | 'dataset-virtual'
  | 'download'
  | 'edit-alt'
  | 'edit'
  | 'email'
  | 'error-solid-small'
  | 'error-solid'
  | 'error'
  | 'expand'
  | 'eye-slash'
  | 'eye'
  | 'favorite-small-selected'
  | 'favorite-selected'
  | 'favorite-unselected'
  | 'field-abc'
  | 'field-boolean'
  | 'field-date'
  | 'field-derived'
  | 'field-num'
  | 'field-struct'
  | 'file'
  | 'filter'
  | 'folder'
  | 'full'
  | 'gear'
  | 'grid'
  | 'image'
  | 'info-solid-small'
  | 'info-solid'
  | 'info'
  | 'join'
  | 'keyboard'
  | 'layers'
  | 'lightbulb'
  | 'list-view'
  | 'list'
  | 'location'
  | 'lock-locked'
  | 'lock-unlocked'
  | 'map'
  | 'message'
  | 'minus-solid'
  | 'minus'
  | 'more-horiz'
  | 'move'
  | 'nav-charts'
  | 'nav-dashboard'
  | 'nav-data'
  | 'nav-explore'
  | 'nav-home'
  | 'nav-lab'
  | 'note'
  | 'paperclip'
  | 'placeholder'
  | 'plus-large'
  | 'plus-small'
  | 'plus-solid'
  | 'plus'
  | 'refresh'
  | 'search'
  | 'server'
  | 'share'
  | 'sort-asc'
  | 'sort-desc'
  | 'sort'
  | 'sql'
  | 'table'
  | 'tag'
  | 'trash'
  | 'triangle-change'
  | 'triangle-down'
  | 'triangle-up'
  | 'up-level'
  | 'user'
  | 'warning-solid'
  | 'warning'
  | 'x-large'
  | 'x-small';

export const iconsRegistry: Record<
  IconName,
  React.ComponentType<SVGProps<SVGSVGElement>>
> = {
  'alert-solid': AlertSolidIcon,
  alert: AlertIcon,
  binoculars: BinocularsIcon,
  'bolt-small-run': BoltSmallRunIcon,
  'bolt-small': BoltSmallIcon,
  bolt: BoltIcon,
  calendar: CalendarIcon,
  'cancel-solid': CancelSolidIcon,
  'cancel-x': CancelXIcon,
  cancel: CancelIcon,
  'card-view': CardViewIcon,
  'cards-locked': CardsLockedIcon,
  cards: CardsIcon,
  'caret-down': CaretDownIcon,
  'caret-left': CaretLeftIcon,
  'caret-right': CaretRightIcon,
  'caret-up': CaretUpIcon,
  certified: CertifiedIcon,
  check: CheckIcon,
  'checkbox-half': CheckboxHalfIcon,
  'checkbox-off': CheckboxOffIcon,
  'checkbox-on': CheckboxOnIcon,
  'circle-check-solid': CircleCheckSolidIcon,
  'circle-check': CircleCheckIcon,
  circle: CircleIcon,
  clock: ClockIcon,
  close: CloseIcon,
  code: CodeIcon,
  cog: CogIcon,
  collapse: CollapseIcon,
  'color-palette': ColorPaletteIcon,
  components: ComponentsIcon,
  copy: CopyIcon,
  'cursor-target': CursorTargeIcon,
  database: DatabaseIcon,
  'dataset-physical': DatasetPhysicalIcon,
  'dataset-virtual-greyscale': DatasetVirtualGreyscaleIcon,
  'dataset-virtual': DatasetVirtualIcon,
  download: DownloadIcon,
  'edit-alt': EditAltIcon,
  edit: EditIcon,
  email: EmailIcon,
  'error-solid-small': ErrorSolidSmallIcon,
  'error-solid': ErrorSolidIcon,
  error: ErrorIcon,
  expand: ExpandIcon,
  'eye-slash': EyeSlashIcon,
  eye: EyeIcon,
  'favorite-small-selected': FavoriteSmallSelectedIcon,
  'favorite-selected': FavoriteSelectedIcon,
  'favorite-unselected': FavoriteUnselectedIcon,
  'field-abc': FieldABCIcon,
  'field-boolean': FieldBooleanIcon,
  'field-date': FieldDateIcon,
  'field-derived': FieldDerivedIcon,
  'field-num': FieldNumIcon,
  'field-struct': FieldStructIcon,
  file: FileIcon,
  filter: FilterIcon,
  folder: FolderIcon,
  full: FullIcon,
  gear: GearIcon,
  grid: GridIcon,
  image: ImageIcon,
  'info-solid-small': InfoSolidSmallIcon,
  'info-solid': InfoSolidIcon,
  info: InfoIcon,
  join: JoinIcon,
  keyboard: KeyboardIcon,
  layers: LayersIcon,
  lightbulb: LightbulbIcon,
  'list-view': ListViewIcon,
  list: ListIcon,
  location: LocationIcon,
  'lock-locked': LockLockedIcon,
  'lock-unlocked': LockUnlockedIcon,
  map: MapIcon,
  message: MessageIcon,
  'minus-solid': MinusSolidIcon,
  minus: MinusIcon,
  'more-horiz': MoreHorizIcon,
  move: MoveIcon,
  'nav-charts': NavChartsIcon,
  'nav-dashboard': NavDashboardIcon,
  'nav-data': NavDataIcon,
  'nav-explore': NavExploreIcon,
  'nav-home': NavHomeIcon,
  'nav-lab': NavLabIcon,
  note: NoteIcon,
  paperclip: PaperclipIcon,
  placeholder: PlaceholderIcon,
  'plus-large': PlusLargeIcon,
  'plus-small': PlusSmallIcon,
  'plus-solid': PlusSolidIcon,
  plus: PlusIcon,
  refresh: RefreshIcon,
  search: SearchIcon,
  server: ServerIcon,
  share: ShareIcon,
  'sort-asc': SortAscIcon,
  'sort-desc': SortDescIcon,
  sort: SortIcon,
  sql: SQLIcon,
  table: TableIcon,
  tag: TagIcon,
  trash: TrashIcon,
  'triangle-change': TriangleChangeIcon,
  'triangle-down': TriangleDownIcon,
  'triangle-up': TriangleUpIcon,
  'up-level': UpLevelIcon,
  user: UserIcon,
  'warning-solid': WarningSolidIcon,
  warning: WarningIcon,
  'x-large': XLargeIcon,
  'x-small': XSmallIcon,
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

const Icon = ({
  name,
  color = '#666666',
  viewBox = '0 0 24 24',
  ...rest
}: IconProps) => {
  const Component = iconsRegistry[name];

  return (
    <Component color={color} viewBox={viewBox} data-test={name} {...rest} />
  );
};

export default Icon;
