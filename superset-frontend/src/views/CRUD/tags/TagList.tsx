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
 import { SupersetClient, t } from '@superset-ui/core';
 import React, { useState, useMemo, useCallback } from 'react';
 import rison from 'rison';
 import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';
 import {
   createFetchRelated,
   createErrorHandler,
   handleDashboardDelete,
   Actions,
 } from 'src/views/CRUD/utils';
 import { useListViewResource } from 'src/views/CRUD/hooks';
 import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
 import SubMenu, { SubMenuProps } from 'src/views/components/SubMenu';
 import ListView, {
   ListViewProps,
   Filters,
   FilterOperator,
 } from 'src/components/ListView';
 import { dangerouslyGetItemDoNotUse } from 'src/utils/localStorageHelpers';
 import withToasts from 'src/components/MessageToasts/withToasts';
 import Icons from 'src/components/Icons';
 import PropertiesModal from 'src/dashboard/components/PropertiesModal';
 import { Tooltip } from 'src/components/Tooltip';
 import TagCard from './TagCard';
import { Tag } from '../types';
import FacePile from 'src/components/FacePile';
import { Link } from 'react-router-dom';
 
 const PAGE_SIZE = 25;
 
 interface TagListProps {
   addDangerToast: (msg: string) => void;
   addSuccessToast: (msg: string) => void;
   user: {
     userId: string | number;
     firstName: string;
     lastName: string;
   };
 }
 
 function TagList(props: TagListProps) {
   const {
     addDangerToast,
     addSuccessToast,
     user: { userId },
   } = props;
 
   const {
     state: {
       loading,
       resourceCount: tagCount,
       resourceCollection: tags,
       bulkSelectEnabled,
     },
     setResourceCollection: setTags,
     hasPerm,
     fetchData,
     toggleBulkSelect,
     refreshData,
   } = useListViewResource<Tag>(
     'tag',
     t('tag'),
     addDangerToast,
   );
 
   const [tagToEdit, setTagToEdit] = useState<Tag | null>(
     null,
   );
 
   // TODO: Fix usage of localStorage keying on the user id
   const userKey = dangerouslyGetItemDoNotUse(userId?.toString(), null);
 
   const canCreate = hasPerm('can_write');
   const canEdit = hasPerm('can_write');
   const canDelete = hasPerm('can_write');

   const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];
 
   function openTagEditModal(tag: Tag) {
     setTagToEdit(tag);
   }
 
   function handleTagEdit(edits: Tag) {
     return SupersetClient.get({
       endpoint: `/api/v1/tag/${edits.id}`,
     }).then(
       ({ json = {} }) => {
         setTags(
           tags.map(tag => {
             if (tag.id === json?.result?.id) {
               const {
                 changed_by_name,
                 changed_by_url,
                 changed_by,
                 dashboard_title = '',
                 slug = '',
                 json_metadata = '',
                 changed_on_delta_humanized,
                 url = '',
                 certified_by = '',
                 certification_details = '',
                 owners,
                 tags,
               } = json.result;
               return {
                 ...tag,
                 changed_by_name,
                 changed_by_url,
                 changed_by,
                 dashboard_title,
                 slug,
                 json_metadata,
                 changed_on_delta_humanized,
                 url,
                 certified_by,
                 certification_details,
                 owners,
                 tags,
               };
             }
             return tag;
           }),
         );
       },
       createErrorHandler(errMsg =>
         addDangerToast(
           t('An error occurred while fetching dashboards: %s', errMsg),
         ),
       ),
     );
   }
 
   function handleBulkTagDelete(tagsToDelete: Tag[]) {
     // TODO fix bulk tag delete
     return SupersetClient.delete({
       endpoint: `/api/v1/tag/?q=${rison.encode(
         tagsToDelete.map(({ id }) => id),
       )}`,
     }).then(
       ({ json = {} }) => {
         refreshData();
         addSuccessToast(json.message);
       },
       createErrorHandler(errMsg =>
         addDangerToast(
           t('There was an issue deleting the selected tags: ', errMsg),
         ),
       ),
     );
   }
 
   const columns = useMemo(
     () => [
       {
         Cell: ({
           row: {
             original: {
               name: tagName,
             },
           },
         }: any) => (
          <Link to={'/superset/all_entities/?tags=' + tagName}>
            {tagName}
          </Link>
        ),
         Header: t('Name'),
         accessor: 'name',
       },
       {
         Cell: ({
           row: {
             original: {
               changed_by_name: changedByName,
               changed_by_url: changedByUrl,
             },
           },
         }: any) => <a href={changedByUrl}>{changedByName}</a>,
         Header: t('Modified by'),
         accessor: 'changed_by.first_name',
         size: 'xl',
       },
       {
         Cell: ({
           row: {
             original: { changed_on_delta_humanized: changedOn },
           },
         }: any) => <span className="no-wrap">{changedOn}</span>,
         Header: t('Modified'),
         accessor: 'changed_on_delta_humanized',
         size: 'xl',
       },
       {
         Cell: ({
           row: {
             original: { created_by: createdBy },
           },
         }: any) =>
           createdBy ? <FacePile users={[createdBy]} /> : '',
         Header: t('Created by'),
         accessor: 'created_by',
         disableSortBy: true,
         size: 'xl',
       },
      //  {
      //    Cell: ({
      //      row: {
      //        original: { num_tagged_objects: numTaggedObjects },
      //      },
      //    }: any) => numTaggedObjects,
      //    Header: t('Number of Tagged Entities'),
      //    accessor: 'num_tagged_objects',
      //    disableSortBy: true,
      //  },
       {
         Cell: ({ row: { original } }: any) => {
           const handleDelete = () =>
             handleDashboardDelete(
               original,
               refreshData,
               addSuccessToast,
               addDangerToast,
             );
           const handleEdit = () => openTagEditModal(original);
 
           return (
             <Actions className="actions">
               {canDelete && (
                 <ConfirmStatusChange
                   title={t('Please confirm')}
                   description={
                     <>
                       {t('Are you sure you want to delete')}{' '}
                       <b>{original.dashboard_title}</b>?
                     </>
                   }
                   onConfirm={handleDelete}
                 >
                   {confirmDelete => (
                     <Tooltip
                       id="delete-action-tooltip"
                       title={t('Delete')}
                       placement="bottom"
                     >
                       <span
                         role="button"
                         tabIndex={0}
                         className="action-button"
                         onClick={confirmDelete}
                       >
                        {/* fix icon name */}
                         <Icons.Trash data-test="dashboard-list-trash-icon" />
                       </span>
                     </Tooltip>
                   )}
                 </ConfirmStatusChange>
               )}
               {canEdit && (
                 <Tooltip
                   id="edit-action-tooltip"
                   title={t('Edit')}
                   placement="bottom"
                 >
                   <span
                     role="button"
                     tabIndex={0}
                     className="action-button"
                     onClick={handleEdit}
                   >
                     <Icons.EditAlt data-test="edit-alt" />
                   </span>
                 </Tooltip>
               )}
             </Actions>
           );
         },
         Header: t('Actions'),
         id: 'actions',
         hidden: !canEdit && !canDelete,
         disableSortBy: true,
       },
     ],
     [
       userId,
       canEdit,
       canDelete,
       refreshData,
       addSuccessToast,
       addDangerToast,
     ],
   );
 
   const filters: Filters = useMemo(() => {
     const filters_list = [
       {
         Header: t('Created by'),
         id: 'created_by',
         input: 'select',
         operator: FilterOperator.relationOneMany,
         unfilteredLabel: t('All'),
         fetchSelects: createFetchRelated(
           'tag',
           'created_by',
           createErrorHandler(errMsg =>
             addDangerToast(
               t(
                 'An error occurred while fetching tag created by values: %s',
                 errMsg,
               ),
             ),
           ),
           props.user,
         ),
         paginate: true,
       },
       {
        Header: t('Search'),
        id: 'name',
        input: 'search',
        operator: FilterOperator.titleOrSlug,
      }
     ] as Filters;
     return filters_list;
   }, [addDangerToast, props.user]);
 
   const sortTypes = [
     {
       desc: false,
       id: 'name',
       label: t('Alphabetical'),
       value: 'alphabetical',
     },
     {
       desc: true,
       id: 'changed_on_delta_humanized',
       label: t('Recently modified'),
       value: 'recently_modified',
     },
     {
       desc: false,
       id: 'changed_on_delta_humanized',
       label: t('Least recently modified'),
       value: 'least_recently_modified',
     },
   ];
 
   const renderCard = useCallback(
     (tag: Tag) => (
       <TagCard
         tag={tag}
         hasPerm={hasPerm}
         bulkSelectEnabled={bulkSelectEnabled}
         refreshData={refreshData}
         showThumbnails={
           userKey
             ? userKey.thumbnails
             : isFeatureEnabled(FeatureFlag.THUMBNAILS)
         }
         userId={userId}
         loading={loading}
         addDangerToast={addDangerToast}
         addSuccessToast={addSuccessToast}
         openTagEditModal={openTagEditModal}
       />
     ),
     [
       addDangerToast,
       addSuccessToast,
       bulkSelectEnabled,
       hasPerm,
       loading,
       userId,
       refreshData,
       userKey,
     ],
   );
 
   const subMenuButtons: SubMenuProps['buttons'] = [];
   if (canDelete) {
     subMenuButtons.push({
       name: t('Bulk select'),
       buttonStyle: 'secondary',
       'data-test': 'bulk-select',
       onClick: toggleBulkSelect,
     });
   }
   if (canCreate) {
     subMenuButtons.push({
       name: (
         <>
           <i className="fa fa-plus" /> {t('Tag')}
         </>
       ),
       buttonStyle: 'primary',
       onClick: () => {
         // TODO Add Tags??
       },
     });
   }
   return (
     <>
       <SubMenu name={t('Tags')} buttons={subMenuButtons} />
       <ConfirmStatusChange
         title={t('Please confirm')}
         description={t(
           'Are you sure you want to delete the selected tags?',
         )}
         onConfirm={handleBulkTagDelete}
       >
         {confirmDelete => {
           const bulkActions: ListViewProps['bulkActions'] = [];
           if (canDelete) {
             bulkActions.push({
               key: 'delete',
               name: t('Delete'),
               type: 'danger',
               onSelect: confirmDelete,
             });
           }
           return (
             <>
               {tagToEdit && (
                 <PropertiesModal
                   dashboardId={tagToEdit.id}
                   show
                   onHide={() => setTagToEdit(null)}
                   onSubmit={handleTagEdit}
                 />
               )}
               <ListView<Tag>
                 bulkActions={bulkActions}
                 bulkSelectEnabled={bulkSelectEnabled}
                 cardSortSelectOptions={sortTypes}
                 className="dashboard-list-view"
                 columns={columns}
                 count={tagCount}
                 data={tags}
                 disableBulkSelect={toggleBulkSelect}
                 fetchData={fetchData}
                 filters={filters}
                 initialSort={initialSort}
                 loading={loading}
                 pageSize={PAGE_SIZE}
                 showThumbnails={
                   userKey
                     ? userKey.thumbnails
                     : isFeatureEnabled(FeatureFlag.THUMBNAILS)
                 }
                 renderCard={renderCard}
                 defaultViewMode={
                   isFeatureEnabled(FeatureFlag.LISTVIEWS_DEFAULT_CARD_VIEW)
                     ? 'card'
                     : 'table'
                 }
               />
             </>
           );
         }}
       </ConfirmStatusChange>
     </>
   );
 }
 
 export default withToasts(TagList);
 