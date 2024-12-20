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
import { t, styled } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import { DropdownButton } from 'src/components/DropdownButton';
import Button from 'src/components/Button';

interface SaveDatasetActionButtonProps {
  setShowSave: (arg0: boolean) => void;
  overlayMenu: JSX.Element | null;
}

const StyledDropdownButton = styled(DropdownButton)`
  button {
    font-size: ${({ theme }) => theme.fontSizeSM}px;
    font-weight: ${({ theme }) => theme.fontWeightStrong};
  }
`;

const SaveDatasetActionButton = ({
  setShowSave,
  overlayMenu,
}: SaveDatasetActionButtonProps) =>
  !overlayMenu ? (
    <Button
      onClick={() => setShowSave(true)}
      buttonStyle="secondary"
      buttonSize="small"
    >
      {t('Save')}
    </Button>
  ) : (
    <StyledDropdownButton
      onClick={() => setShowSave(true)}
      dropdownRender={() => overlayMenu}
      icon={<Icons.CaretDown name="caret-down" />}
      trigger={['click']}
    >
      {t('Save')}
    </StyledDropdownButton>
  );

export default SaveDatasetActionButton;
