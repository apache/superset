import React, { useEffect, useState } from 'react';
import { t } from '@superset-ui/core';
import { ModalProps } from 'src/dvt-modal';
import useFetch from 'src/hooks/useFetch';
import DvtButton from 'src/components/DvtButton';
import DvtInput from 'src/components/DvtInput';
import {
  StyledDashboardEdit,
  StyledDashboardEditBody,
  StyledDashboardEditHeader,
  StyledDashboardEditInput,
} from './dashboard-edit.module';

const DvtDashboardEdit = ({ meta, onClose }: ModalProps) => {
  const [title, setTitle] = useState<string>(meta.result.dashboard_title);
  const [slugUrl, setSlugUrl] = useState<string>(meta.result.slug);
  const [owners, setOwners] = useState<string>(
    `${meta.result.owners[0].first_name} ${meta.result.owners[0].last_name}`,
  );
  const [changedNyName, setChangedByName] = useState<string>(
    meta.result.changed_by_name,
  );
  const [certifiedBy, setCertifiedBy] = useState<string>(
    meta.result.certified_by,
  );
  const [dashboardApi, setDashboardApi] = useState<string>('');

  const updateDashboardData = useFetch({
    url: dashboardApi,
    method: 'PUT',
    body: {
      certification_details: certifiedBy,
      certified_by: changedNyName,
      dashboard_title: title,
      owners: [1],
      slug: slugUrl,
      json_metadata: '{"shared_label_colors": {}, "color_scheme_domain": []}',
    },
  });

  useEffect(() => {
    if (updateDashboardData?.id) {
      onClose();
    }
  }, [onClose, updateDashboardData]);

  return (
    <StyledDashboardEdit>
      <StyledDashboardEditHeader>
        <DvtButton
          colour="primary"
          label={t('SAVE')}
          typeColour="powder"
          onClick={() => setDashboardApi(`/api/v1/dashboard/${meta.result.id}`)}
          size="small"
        />
      </StyledDashboardEditHeader>
      <StyledDashboardEditBody>
        <StyledDashboardEditInput>
          <DvtInput
            value={title}
            label={t('Title')}
            onChange={setTitle}
            typeDesign="form"
          />
          <DvtInput
            value={slugUrl}
            label={t('Url Slug')}
            onChange={setSlugUrl}
            typeDesign="form"
          />
          <DvtInput
            value={owners}
            label={t('Owners')}
            onChange={setOwners}
            typeDesign="form"
          />
        </StyledDashboardEditInput>
        <StyledDashboardEditInput>
          <DvtInput
            value={changedNyName}
            label={t('CERTIFIED BY')}
            onChange={setChangedByName}
            typeDesign="form"
          />
          <DvtInput
            value={certifiedBy}
            label={t('CERTIFICATION DETAILS')}
            onChange={setCertifiedBy}
            typeDesign="form"
          />
        </StyledDashboardEditInput>
      </StyledDashboardEditBody>
    </StyledDashboardEdit>
  );
};

export default DvtDashboardEdit;
