import { useState, useEffect } from 'react';
import { t, styled, SupersetClient } from '@superset-ui/core';
import { Modal, Select, Button } from '@superset-ui/core/components';

interface TemplateOption {
  value: number;
  label: string;
}

interface ReportTemplateModalProps {
  show: boolean;
  onHide: () => void;
}

const FullWidthSelect = styled(Select)`
  width: 100%;
`;

export default function ReportTemplateModal({ show, onHide }: ReportTemplateModalProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selected, setSelected] = useState<TemplateOption | null>(null);

  useEffect(() => {
    if (show) {
      SupersetClient.get({ endpoint: '/api/v1/report_template/' })
        .then(({ json }) => {
          setTemplates(
            (json.result || []).map((t: any) => ({ value: t.id, label: t.name })),
          );
        })
        .catch(error => {
          // eslint-disable-next-line no-console
          console.error('Failed to load templates', error);
        });
    }
  }, [show]);

  const onGenerate = () => {
    if (!selected) return;
    SupersetClient.post({
      endpoint: `/api/v1/report_template/${selected}/generate`,
      parseMethod: 'raw',
    })
      .then((response: Response) => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selected.label}.odt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      })
      .catch(err => {
        // eslint-disable-next-line no-console
        console.error('Error generating report', err);
      })
      .finally(onHide);
  };

  return (
    <Modal
      show={show}
      title={t('Generate report')}
      onHide={onHide}
      footer={
        <div>
          <Button buttonStyle="secondary" onClick={onHide}>
            {t('Cancel')}
          </Button>
          <Button
            buttonStyle="primary"
            disabled={!selected}
            onClick={onGenerate}
          >
            {t('Generate')}
          </Button>
        </div>
      }
    >
      <FullWidthSelect
        ariaLabel={t('Select template')}
        options={templates}
        placeholder={t('Choose a template')}
        onChange={option => setSelected(option as TemplateOption)}
        value={selected}
      />
    </Modal>
  );
}
