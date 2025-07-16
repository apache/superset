import { useCallback, useMemo, useState } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import withToasts from 'src/components/MessageToasts/withToasts';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import {
  ListView,
  ListViewActionsBar,
  type ListViewActionProps,
} from 'src/components';

import { Icons } from '@superset-ui/core/components/Icons';
import { UploadReportTemplateModal } from 'src/features/reportTemplates';

interface TemplateObject {
  id: number;
  name: string;
  description: string;
  dataset_id: number;
}

interface TemplateListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

function ReportTemplateList({ addDangerToast, addSuccessToast }: TemplateListProps) {
  const [data, setData] = useState<TemplateObject[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchData = useCallback(({ pageIndex, pageSize }: any) => {
    setLoading(true);
    const offset = pageIndex * pageSize;
    SupersetClient.get({
      endpoint: `/api/v1/report_template/?limit=${pageSize}&offset=${offset}`,
    })
      .then(({ json }) => {
        setData(json.result);
        setCount(json.count ?? json.result.length);
      })
      .catch(err => {
        addDangerToast(t('Error loading templates: %s', err.message));
      })
      .finally(() => setLoading(false));
  }, [addDangerToast]);

  const handleDownload = (id: number) => {
    SupersetClient.get({
      endpoint: `/api/v1/report_template/${id}/download`,
      parseMethod: 'raw',
    })
      .then((resp: Response) => resp.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'template.odt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      })
      .catch(err => {
        addDangerToast(t('Failed to download template: %s', err.message));
      });
  };

  const handleGenerate = (id: number) => {
    SupersetClient.post({
      endpoint: `/api/v1/report_template/${id}/generate`,
      parseMethod: 'raw',
    })
      .then((resp: Response) => resp.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'report.odt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      })
      .catch(err => {
        addDangerToast(t('Failed to generate report: %s', err.message));
      });
  };

  const handleDelete = (id: number) => {
    SupersetClient.delete({ endpoint: `/api/v1/report_template/${id}` })
      .then(() => {
        addSuccessToast(t('Deleted'));
        fetchData({ pageIndex: 0, pageSize: 25 });
      })
      .catch(err => {
        addDangerToast(t('Failed to delete: %s', err.message));
      });
  };

  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        Header: t('Name'),
        id: 'name',
      },
      {
        accessor: 'description',
        Header: t('Description'),
        id: 'description',
      },
      {
        accessor: 'dataset_id',
        Header: t('Dataset ID'),
        id: 'dataset_id',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const actions = [
            {
              label: 'download',
              tooltip: t('Download'),
              placement: 'bottom',
              icon: 'DownloadOutlined',
              onClick: () => handleDownload(original.id),
            },
            {
              label: 'edit',
              tooltip: t('Edit'),
              placement: 'bottom',
              icon: 'EditOutlined',
              onClick: () => handleDownload(original.id),
            },
            {
              label: 'generate',
              tooltip: t('Generate report'),
              placement: 'bottom',
              icon: 'FileTextOutlined',
              onClick: () => handleGenerate(original.id),
            },
            {
              label: 'delete',
              tooltip: t('Delete'),
              placement: 'bottom',
              icon: 'DeleteOutlined',
              onClick: () => handleDelete(original.id),
            },
          ];
          return <ListViewActionsBar actions={actions as ListViewActionProps[]} />;
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
      },
    ],
    [],
  );

  const menuData: SubMenuProps = { name: t('Report templates') };
  menuData.buttons = [
    {
      name: (
        <>
          <Icons.PlusOutlined iconSize="m" />
          {t('Report template')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => setShowModal(true),
    },
  ];

  return (
    <>
      <SubMenu {...menuData} />
      <UploadReportTemplateModal
        show={showModal}
        onHide={() => setShowModal(false)}
        onUpload={() => fetchData({ pageIndex: 0, pageSize: 25 })}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
      />
      <ListView<TemplateObject>
        className="report-template-list"
        columns={columns}
        count={count}
        data={data}
        fetchData={fetchData}
        loading={loading}
        pageSize={25}
        refreshData={() => fetchData({ pageIndex: 0, pageSize: 25 })}
        addSuccessToast={addSuccessToast}
        addDangerToast={addDangerToast}
      />
    </>
  );
}

export default withToasts(ReportTemplateList);
