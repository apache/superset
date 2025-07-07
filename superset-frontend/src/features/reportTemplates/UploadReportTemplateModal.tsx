import { useState } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import { Modal, Input, Button } from '@superset-ui/core/components';

interface UploadReportTemplateModalProps {
  show: boolean;
  onHide: () => void;
  onUpload: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

export default function UploadReportTemplateModal({
  show,
  onHide,
  onUpload,
  addDangerToast,
  addSuccessToast,
}: UploadReportTemplateModalProps) {
  const [name, setName] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const reset = () => {
    setName('');
    setDatasetId('');
    setDescription('');
    setFile(null);
  };

  const handleUpload = () => {
    if (!file || !name || !datasetId) {
      addDangerToast(t('All fields are required'));
      return;
    }
    const form = new FormData();
    form.append('template', file);
    form.append('name', name);
    form.append('dataset_id', datasetId);
    if (description) form.append('description', description);
    SupersetClient.post({
      endpoint: '/api/v1/report_template/',
      postPayload: form,
      stringify: false,
    })
      .then(() => {
        addSuccessToast(t('Template uploaded'));
        reset();
        onUpload();
        onHide();
      })
      .catch(err => {
        addDangerToast(t('Failed to upload template: %s', err.message));
      });
  };

  return (
    <Modal
      show={show}
      title={t('Add report template')}
      onHide={onHide}
      footer={
        <div>
          <Button buttonStyle="secondary" onClick={onHide}>
            {t('Cancel')}
          </Button>
          <Button buttonStyle="primary" onClick={handleUpload}>
            {t('Upload')}
          </Button>
        </div>
      }
    >
      <div className="field">
        <label htmlFor="template-name">{t('Name')}</label>
        <Input
          id="template-name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="template-dataset">{t('Dataset id')}</label>
        <Input
          id="template-dataset"
          value={datasetId}
          onChange={e => setDatasetId(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="template-desc">{t('Description')}</label>
        <Input.TextArea
          id="template-desc"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
      <div className="field">
        <input
          type="file"
          accept=".odt"
          onChange={e => setFile(e.target.files?.[0] || null)}
        />
      </div>
    </Modal>
  );
}
