import React, { useState } from 'react';
import { t } from '@superset-ui/core';
import { useDispatch } from 'react-redux';
import { useAppSelector } from 'src/hooks/useAppSelector';
import { closeModal } from 'src/dvt-redux/dvt-modalReducer';
import DvtButton from 'src/components/DvtButton';
import DvtInput from 'src/components/DvtInput';
import {
  StyledDashboardEdit,
  StyledDashboardEditBody,
  StyledDashboardEditHeader,
  StyledDashboardEditInput,
} from './dashboard-edit.module';

const DvtDashboardEdit = () => {
  const dispatch = useDispatch();
  const meta = useAppSelector(state => state.dvtModal.meta);
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

  const useUpdateData = async () => {
    try {
      await fetch(`/api/v1/dashboard/${meta.result.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          certification_details: certifiedBy,
          certified_by: changedNyName,
          dashboard_title: title,
          owners: [1],
          slug: slugUrl,
          json_metadata:
            '{"shared_label_colors": {}, "color_scheme_domain": []}',
        }),
      });
      dispatch(closeModal());
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <StyledDashboardEdit>
      <StyledDashboardEditHeader>
        <DvtButton
          colour="primary"
          label={t('SAVE')}
          typeColour="powder"
          onClick={useUpdateData}
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
