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

import { useMemo, useState } from 'react';
import { t, SupersetClient } from '@superset-ui/core';

import rison from 'rison';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { createErrorHandler, createFetchRelated } from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import DeleteModal from 'src/components/DeleteModal';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import ActionsBar, { ActionProps } from 'src/components/ListView/ActionsBar';
import ListView, {
  ListViewProps,
  Filters,
  FilterOperator,
} from 'src/components/ListView';
import CssTemplateModal from 'src/features/cssTemplates/CssTemplateModal';
import { TemplateObject } from 'src/features/cssTemplates/types';
import { ModifiedInfo } from 'src/components/AuditInfo';
import { QueryObjectColumns } from 'src/views/CRUD/types';

const PAGE_SIZE = 25;

interface CssTemplatesListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

function CssTemplatesList({
  addDangerToast,
  addSuccessToast,
  user,
}: CssTemplatesListProps) {
  const {
    state: {
      loading,
      resourceCount: templatesCount,
      resourceCollection: templates,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    refreshData,
    toggleBulkSelect,
  } = useListViewResource<TemplateObject>(
    'css_template',
    t('CSS templates'),
    addDangerToast,
  );
  const [cssTemplateModalOpen, setCssTemplateModalOpen] =
    useState<boolean>(false);
  const [currentCssTemplate, setCurrentCssTemplate] =
    useState<TemplateObject | null>(null);

  const canCreate = hasPerm('can_write');
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');

  const [templateCurrentlyDeleting, setTemplateCurrentlyDeleting] =
    useState<TemplateObject | null>(null);

  const handleTemplateDelete = ({ id, template_name }: TemplateObject) => {
    SupersetClient.delete({
      endpoint: `/api/v1/css_template/${id}`,
    }).then(
      () => {
        refreshData();
        setTemplateCurrentlyDeleting(null);
        addSuccessToast(t('Deleted: %s', template_name));
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting %s: %s', template_name, errMsg),
        ),
      ),
    );
  };

  const handleBulkTemplateDelete = (templatesToDelete: TemplateObject[]) => {
    SupersetClient.delete({
      endpoint: `/api/v1/css_template/?q=${rison.encode(
        templatesToDelete.map(({ id }) => id),
      )}`,
    }).then(
      ({ json = {} }) => {
        refreshData();
        addSuccessToast(json.message);
      },
      createErrorHandler(errMsg =>
        addDangerToast(
          t('There was an issue deleting the selected templates: %s', errMsg),
        ),
      ),
    );
  };

  function handleCssTemplateEdit(cssTemplate: TemplateObject) {
    setCurrentCssTemplate(cssTemplate);
    setCssTemplateModalOpen(true);
  }

  const initialSort = [{ id: 'template_name', desc: true }];
  const columns = useMemo(
    () => [
      {
        accessor: 'template_name',
        Header: t('Name'),
      },
      {
        Cell: ({
          row: {
            original: {
              changed_on_delta_humanized: changedOn,
              changed_by: changedBy,
            },
          },
        }: any) => <ModifiedInfo date={changedOn} user={changedBy} />,
        Header: t('Last modified'),
        accessor: 'changed_on_delta_humanized',
        size: 'xl',
        disableSortBy: true,
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleEdit = () => handleCssTemplateEdit(original);
          const handleDelete = () => setTemplateCurrentlyDeleting(original);

          const actions = [
            canEdit
              ? {
                  label: 'edit-action',
                  tooltip: t('Edit template'),
                  placement: 'bottom',
                  icon: 'Edit',
                  onClick: handleEdit,
                }
              : null,
            canDelete
              ? {
                  label: 'delete-action',
                  tooltip: t('Delete template'),
                  placement: 'bottom',
                  icon: 'Trash',
                  onClick: handleDelete,
                }
              : null,
          ].filter(item => !!item);

          return <ActionsBar actions={actions as ActionProps[]} />;
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        hidden: !canEdit && !canDelete,
        size: 'xl',
      },
      {
        accessor: QueryObjectColumns.ChangedBy,
        hidden: true,
      },
    ],
    [canDelete, canCreate],
  );

  const menuData: SubMenuProps = {
    name: t('CSS templates'),
  };

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (canCreate) {
    subMenuButtons.push({
      name: (
        <>
          <i className="fa fa-plus" /> {t('CSS template')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => {
        setCurrentCssTemplate(null);
        setCssTemplateModalOpen(true);
      },
    });
  }

  if (canDelete) {
    subMenuButtons.push({
      name: t('Bulk select'),
      onClick: toggleBulkSelect,
      buttonStyle: 'secondary',
    });
  }

  menuData.buttons = subMenuButtons;

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('Name'),
        key: 'search',
        id: 'template_name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Modified by'),
        key: 'changed_by',
        id: 'changed_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'css_template',
          'changed_by',
          createErrorHandler(errMsg =>
            t(
              'An error occurred while fetching dataset datasource values: %s',
              errMsg,
            ),
          ),
          user,
        ),
        paginate: true,
      },
    ],
    [],
  );

  return (
    <>
      <SubMenu {...menuData} />
      <CssTemplateModal
        addDangerToast={addDangerToast}
        cssTemplate={currentCssTemplate}
        onCssTemplateAdd={() => refreshData()}
        onHide={() => setCssTemplateModalOpen(false)}
        show={cssTemplateModalOpen}
      />
      {templateCurrentlyDeleting && (
        <DeleteModal
          description={t('This action will permanently delete the template.')}
          onConfirm={() => {
            if (templateCurrentlyDeleting) {
              handleTemplateDelete(templateCurrentlyDeleting);
            }
          }}
          onHide={() => setTemplateCurrentlyDeleting(null)}
          open
          title={t('Delete Template?')}
        />
      )}
      <ConfirmStatusChange
        title={t('Please confirm')}
        description={t(
          'Are you sure you want to delete the selected templates?',
        )}
        onConfirm={handleBulkTemplateDelete}
      >
        {confirmDelete => {
          const bulkActions: ListViewProps['bulkActions'] = canDelete
            ? [
                {
                  key: 'delete',
                  name: t('Delete'),
                  onSelect: confirmDelete,
                  type: 'danger',
                },
              ]
            : [];

          return (
            <ListView<TemplateObject>
              className="css-templates-list-view"
              columns={columns}
              count={templatesCount}
              data={templates}
              fetchData={fetchData}
              filters={filters}
              initialSort={initialSort}
              loading={loading}
              pageSize={PAGE_SIZE}
              bulkActions={bulkActions}
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={toggleBulkSelect}
              addDangerToast={addDangerToast}
              addSuccessToast={addSuccessToast}
              refreshData={refreshData}
            />
          );
        }}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(CssTemplatesList);
