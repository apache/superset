import type { FC } from 'react';
import styled from '@emotion/styled';
import { t, useTheme } from '@superset-ui/core';
import { Col, Descriptions, Divider, Row, Space, Tag, Typography } from 'antd';
import Button from '../../../../components/Button';
import { useRequest } from './useRequest';
import Loading from '../../../../components/Loading';
import { RequestFindTeam } from '../../components/RequestFindTeam/requestFindTeam';
import { RequestData } from './components/RequestData';
import { CreateTeamModal } from '../../components/CreateTeamModal/CreateTeamModal';
import { RoleDescription } from './components/RoleDescription';
import { ConfirmCreateTeamModal } from '../../components/ConfirmCreateTeamModal/ConfirmCreateTeamModal';
import { UpdateUser } from './components/UpdateUser';
import { UserFromEnum } from '../../types';

const Wrapper = styled.div`
  padding: 2rem;
`;

const StyledSpace = styled(Space)`
  width: 100%;
`;

const StyledButton = styled(Button)`
  width: 100%;
`;

export const RequestPage: FC = () => {
  const theme = useTheme();

  const {
    isLoading,
    requestData,
    newTeam,
    setNewTeam,
    existingTeam,
    setExistingTeam,
    showCreateTeam,
    closeCreateTeam,
    tagClosable,
    removeTeam,
    newTeamOK,
    teamOK,
    formatedTeamName,
    createTeamData,
    openConfirmCreateTeam,
    closeConfirmCreateTeam,
    createTeamInHook,
    confirmCreateTeamData,
    showUpdateUser,
    closeUpdateUser,
    updateUserData,
    updateUser,
  } = useRequest();

  return (
    <Wrapper>
      {isLoading ? (
        <Loading />
      ) : (
        <>
          <RequestData data={requestData} />

          <Divider orientation="left">{t('Team search')}</Divider>

          <Row gutter={24}>
            <Col span={8}>
              <StyledSpace direction="vertical" size="middle">
                <RequestFindTeam
                  userFrom={requestData?.userFrom ?? UserFromEnum.Franchisee}
                  newTeam={newTeam}
                  setNewTeam={setNewTeam}
                  existingTeam={existingTeam}
                  setExistingTeam={setExistingTeam}
                  disabled={requestData?.isClosed}
                />
                {teamOK && (
                  <>
                    <Typography.Paragraph>
                      <Space direction="horizontal" size="small">
                        <Typography.Text>
                          {t(newTeam ? 'New team' : 'Existing team')}
                        </Typography.Text>
                        <Tag
                          color="#ff6900"
                          closable={tagClosable}
                          onClose={removeTeam}
                        >
                          {formatedTeamName}
                        </Tag>
                      </Space>
                    </Typography.Paragraph>
                  </>
                )}

                {newTeamOK && (
                  <StyledButton
                    type="primary"
                    htmlType="button"
                    disabled={requestData?.isClosed}
                    onClick={showCreateTeam}
                  >
                    {t('Create team')}
                  </StyledButton>
                )}

                {existingTeam && (
                  <StyledButton
                    type="primary"
                    htmlType="button"
                    onClick={showUpdateUser}
                    disabled={requestData?.isClosed}
                  >
                    {t('Check information and update user')}
                  </StyledButton>
                )}
              </StyledSpace>
            </Col>
            <Col span={8}>
              <Descriptions
                // title={t('What roles and teams should be?')}
                size="small"
                bordered
                // column={{ xxl: 3, xl: 3, lg: 3, md: 1, sm: 1, xs: 1 }}
                column={1}
                contentStyle={{
                  backgroundColor: theme.colors.grayscale.light5,
                }}
              >
                <Descriptions.Item label={t('If this is C-level')}>
                  {t('give: c_level')}
                </Descriptions.Item>
                <Descriptions.Item label={t("If it's a franchisee")}>
                  {t('Give: fr_{last name}_{first name}')}
                </Descriptions.Item>
                <Descriptions.Item label={t('If from management company')}>
                  {t('Give: by the name of the team')}
                </Descriptions.Item>
              </Descriptions>
            </Col>
            <Col span={8}>
              <RoleDescription />
            </Col>
          </Row>
          {createTeamData && (
            <CreateTeamModal
              onCloseModal={closeCreateTeam}
              onSubmit={openConfirmCreateTeam}
              data={createTeamData}
            />
          )}
          {confirmCreateTeamData && (
            <ConfirmCreateTeamModal
              onCloseModal={closeConfirmCreateTeam}
              onSubmit={createTeamInHook}
              data={confirmCreateTeamData}
            />
          )}
          {updateUserData && (
            <UpdateUser
              onCloseModal={closeUpdateUser}
              data={updateUserData}
              onSubmit={updateUser}
            />
          )}
        </>
      )}
    </Wrapper>
  );
};
