import { FC } from 'react';
import { Space, Tag as TagAnt, Typography } from 'antd';
import { styled, t } from '@superset-ui/core';
import { Col, Row } from 'src/components';
import { Radio } from 'src/components/Radio';
import { useSelector } from 'react-redux';
import Modal from '../../../../components/Modal';
import { UserFromEnum } from '../../types';
import { SelectRoles } from './components/selectRoles';
import { ButtonWithTopMargin } from '../styles';
import { useStepTwoPopup } from './useStepTwoPopup';
import { getOnboardingFinishUpdating } from '../../model/selectors/getOnboardingFinishUpdating';
import Loading from '../../../../components/Loading';
import { RequestFindTeam } from '../RequestFindTeam/requestFindTeam';

const Wrapper = styled.div`
  padding: 1.5rem;
`;

const StyledSpace = styled(Space)`
  width: 100%;
`;

type Props = {
  onClose: () => void;
  onFinish: (value: boolean) => void;
};

const userFromOptions = [
  { label: t(UserFromEnum.Franchisee), value: UserFromEnum.Franchisee },
  {
    label: t(UserFromEnum.ManagingCompany),
    value: UserFromEnum.ManagingCompany,
  },
];

export const StepTwoPopup: FC<Props> = ({ onClose, onFinish }) => {
  const {
    userFrom,
    toggleUseFrom,
    newTeam,
    existingTeam,
    setRoles,
    setNewTeam,
    setExistingTeam,
    noTeam,
    roles,
    formatedTeamName,
    submit,
    removeTeam,
    tagClosable,
    teamDescription,
  } = useStepTwoPopup(onFinish);

  const isFinishUpdating = useSelector(getOnboardingFinishUpdating);
  const { Title } = Typography;

  return (
    <Modal
      show
      title={t('You are welcome to Superset')}
      hideFooter
      onHide={onClose}
      width="1000px"
    >
      <Wrapper>
        <Row gutter={32}>
          <Col span={14}>
            <Title level={3}>{t('Tell us why you are here')}</Title>

            <Typography.Title level={5}>
              {t('Are you a franchisee or from a Managing Company?')}
            </Typography.Title>

            <Space direction="vertical" size="small">
              <Radio.Group
                name="userFrom"
                value={userFrom}
                onChange={toggleUseFrom}
                options={userFromOptions}
              />
              <span />
            </Space>

            <>
              <Typography.Title level={5}>
                {t('Create of find your team')}
              </Typography.Title>

              <StyledSpace direction="vertical" size="small">
                <Typography.Text type="secondary">
                  {t('Select `C_LEVEL` if you are a ‘C level’ in DODO')}
                </Typography.Text>

                <RequestFindTeam
                  newTeam={newTeam}
                  existingTeam={existingTeam}
                  userFrom={userFrom}
                  setExistingTeam={setExistingTeam}
                  setNewTeam={setNewTeam}
                  setRoles={setRoles}
                />

                <Space direction="horizontal" size="small">
                  <Typography.Text>{t('Your team name is')}</Typography.Text>
                  <TagAnt
                    color="#ff6900"
                    closable={tagClosable}
                    onClose={removeTeam}
                  >
                    {formatedTeamName}
                  </TagAnt>
                </Space>

                {teamDescription && (
                  <Typography.Text type="secondary">
                    {teamDescription}
                  </Typography.Text>
                )}
              </StyledSpace>
            </>

            <SelectRoles
              noTeam={noTeam}
              existingTeam={!!existingTeam}
              isFranchisee={userFrom === UserFromEnum.Franchisee}
              roles={roles}
              setRoles={setRoles}
            />

            <ButtonWithTopMargin
              type="primary"
              htmlType="submit"
              buttonSize="default"
              disabled={noTeam || roles.length === 0}
              onClick={submit}
              loading={isFinishUpdating}
            >
              {t('Finish onboarding')}
            </ButtonWithTopMargin>
          </Col>
          <Col span={10}>
            <img
              src="/static/assets/images/onBoardingStepTwo.png"
              alt="onBoardingStepTwo"
              width="100%"
            />
          </Col>
        </Row>
      </Wrapper>
      {isFinishUpdating && <Loading />}
    </Modal>
  );
};
