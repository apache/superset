import React, { useState } from 'react';
import { useAppSelector } from 'src/hooks/useAppSelector';
import DvtButton from 'src/components/DvtButton';
import DvtInput from 'src/components/DvtInput';
import {
  StyledDashboardEdit,
  StyledDashboardEditBody,
  StyledDashboardEditHeader,
  StyledDashboardEditInput,
} from './dashboard-edit.module';

const DvtDashboardEdit = () => {
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

  return (
    <StyledDashboardEdit>
      <StyledDashboardEditHeader>
        <DvtButton
          colour="primary"
          label="SAVE"
          typeColour="powder"
          onClick={() => {}}
          size="small"
        />
      </StyledDashboardEditHeader>
      <StyledDashboardEditBody>
        <StyledDashboardEditInput>
          <DvtInput
            value={title}
            label="Title"
            onChange={setTitle}
            typeDesign="form"
          />
          <DvtInput
            value={slugUrl}
            label="Url Slug"
            onChange={setSlugUrl}
            typeDesign="form"
          />
          <DvtInput
            value={owners}
            label="Owners"
            onChange={setOwners}
            typeDesign="form"
          />
          <DvtInput
            value={changedNyName}
            label="CERTIFIED BY"
            onChange={setChangedByName}
            typeDesign="form"
          />
          <DvtInput
            value={certifiedBy}
            label="CERTIFICATION DETAILS"
            onChange={setCertifiedBy}
            typeDesign="form"
          />
        </StyledDashboardEditInput>
      </StyledDashboardEditBody>
    </StyledDashboardEdit>
  );
};

export default DvtDashboardEdit;
