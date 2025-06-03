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

import { useCallback, useEffect, useState } from 'react';
import { css, t, SupersetClient, useTheme, styled } from '@superset-ui/core';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { Icons } from 'src/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { Descriptions } from 'src/components/Descriptions';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import {
  UserInfoEditModal,
  UserInfoResetPasswordModal,
} from 'src/features/userInfo/UserInfoModal';
import Collapse from 'src/components/Collapse';

interface UserInfoProps {
  user: UserWithPermissionsAndRoles;
}

const StyledHeader = styled.div`
  ${({ theme }) => css`
    font-weight: ${theme.typography.weights.bold};
    text-align: left;
    font-size: 18px;
    padding: ${theme.gridUnit * 3}px;
    padding-left: ${theme.gridUnit * 7}px;
    display: inline-block;
    line-height: ${theme.gridUnit * 9}px;
    width: 100%;
    background-color: ${theme.colors.grayscale.light5};
    margin-bottom: ${theme.gridUnit * 6}px;
  `}
`;

const DescriptionsContainer = styled.div`
  ${({ theme }) => css`
    margin: 0px ${theme.gridUnit * 3}px ${theme.gridUnit * 6}px
      ${theme.gridUnit * 3}px;
    background-color: ${theme.colors.grayscale.light5};
  `}
`;

const StyledLayout = styled.div`
  ${({ theme }) => css`
    .antd5-row {
      margin: 0px ${theme.gridUnit * 3}px ${theme.gridUnit * 6}px
        ${theme.gridUnit * 3}px;
    }
    && .menu > .antd5-menu {
      padding: 0px;
    }
    && .nav-right {
      left: 0;
      padding-left: ${theme.gridUnit * 4}px;
      position: relative;
      height: ${theme.gridUnit * 15}px;
      background-color: ${theme.colors.grayscale.light5};
    }
  `}
`;

const DescriptionTitle = styled.span`
  font-weight: ${({ theme }) => theme.typography.weights.bold};
`;

enum ModalType {
  ResetPassword = 'resetPassword',
  Edit = 'edit',
}

export function UserInfo({ user }: UserInfoProps) {
  const theme = useTheme();
  const [modalState, setModalState] = useState({
    resetPassword: false,
    edit: false,
  });
  const openModal = (type: ModalType) =>
    setModalState(prev => ({ ...prev, [type]: true }));
  const closeModal = (type: ModalType) =>
    setModalState(prev => ({ ...prev, [type]: false }));
  const { addDangerToast } = useToasts();
  const [userDetails, setUserDetails] = useState(user);

  useEffect(() => {
    getUserDetails();
  }, []);

  const getUserDetails = useCallback(() => {
    SupersetClient.get({ endpoint: '/api/v1/me/' })
      .then(({ json }) => {
        const transformedUser = {
          ...json.result,
          firstName: json.result.first_name,
          lastName: json.result.last_name,
        };
        setUserDetails(transformedUser);
      })
      .catch(error => {
        addDangerToast('Failed to fetch user info:', error);
      });
  }, [userDetails]);

  const SubMenuButtons: SubMenuProps['buttons'] = [
    {
      name: (
        <>
          <Icons.LockOutlined
            iconColor={theme.colors.primary.base}
            iconSize="m"
            css={css`
              margin: auto ${theme.gridUnit * 2}px auto 0;
              vertical-align: text-top;
            `}
          />
          {t('Reset my password')}
        </>
      ),
      buttonStyle: 'secondary',
      onClick: () => {
        openModal(ModalType.ResetPassword);
      },
      'data-test': 'reset-password-button',
    },
    {
      name: (
        <>
          <Icons.FormOutlined
            iconColor={theme.colors.primary.light5}
            iconSize="m"
            css={css`
              margin: auto ${theme.gridUnit * 2}px auto 0;
              vertical-align: text-top;
            `}
          />
          {t('Edit user')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => {
        openModal(ModalType.Edit);
      },
      'data-test': 'edit-user-button',
    },
  ];

  return (
    <StyledLayout>
      <StyledHeader>Your user information</StyledHeader>
      <DescriptionsContainer>
        <Collapse defaultActiveKey={['userInfo', 'personalInfo']} ghost>
          <Collapse.Panel
            header={<DescriptionTitle>User info</DescriptionTitle>}
            key="userInfo"
          >
            <Descriptions
              bordered
              size="small"
              column={1}
              labelStyle={{ width: '120px' }}
            >
              <Descriptions.Item label="User Name">
                {user.username}
              </Descriptions.Item>
              <Descriptions.Item label="Is Active?">
                {user.isActive ? 'Yes' : 'No'}
              </Descriptions.Item>
              <Descriptions.Item label="Role">
                {user.roles ? Object.keys(user.roles).join(', ') : 'None'}
              </Descriptions.Item>
              <Descriptions.Item label="Login count">
                {user.loginCount}
              </Descriptions.Item>
            </Descriptions>
          </Collapse.Panel>
          <Collapse.Panel
            header={<DescriptionTitle>Personal info</DescriptionTitle>}
            key="personalInfo"
          >
            <Descriptions
              bordered
              size="small"
              column={1}
              labelStyle={{ width: '120px' }}
            >
              <Descriptions.Item label="First Name">
                {userDetails.firstName}
              </Descriptions.Item>
              <Descriptions.Item label="Last Name">
                {userDetails.lastName}
              </Descriptions.Item>
              <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
            </Descriptions>
          </Collapse.Panel>
        </Collapse>
      </DescriptionsContainer>
      {modalState.resetPassword && (
        <UserInfoResetPasswordModal
          onHide={() => closeModal(ModalType.ResetPassword)}
          show={modalState.resetPassword}
          onSave={() => {
            closeModal(ModalType.ResetPassword);
          }}
        />
      )}
      {modalState.edit && (
        <UserInfoEditModal
          onHide={() => closeModal(ModalType.Edit)}
          show={modalState.edit}
          onSave={() => {
            closeModal(ModalType.Edit);
            getUserDetails();
          }}
          user={userDetails}
        />
      )}
      <SubMenu buttons={SubMenuButtons} />
    </StyledLayout>
  );
}

export default UserInfo;
