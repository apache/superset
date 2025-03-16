import { FC, useCallback } from 'react';
import { Col, Row } from 'src/components';
import { Typography } from 'antd';
import { styled, t } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import Modal from '../../../../components/Modal';
import { Form, FormItem } from '../../../../components/Form';
import { StepOnePopupDto } from './stepOnePopup.dto';
import { Input } from '../../../../components/Input';
import Loading from '../../../../components/Loading';
import { ButtonWithTopMargin } from '../styles';
import { getOnboardingStartedTime } from '../../model/selectors/getStepOneData';
import { getOnboardingStepOneUpdating } from '../../model/selectors/getOnboardingStepOneUpdating';

const Wrapper = styled.div`
  padding: 1.5rem;
`;

type Props = {
  onClose: () => void;
  onNextStep: (dto: StepOnePopupDto) => void;
};

export const StepOnePopup: FC<Props> = ({ onNextStep, onClose }) => {
  const { firstName, lastName, email } = useSelector(getOnboardingStartedTime);
  const isUpdating = useSelector(getOnboardingStepOneUpdating);
  const { Title, Paragraph } = Typography;

  const handleRoleKeyPress = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const regExp = /[a-zA-Zа-яА-Я0-9 ._-]/;
      if (!regExp.test(event.key)) {
        event.preventDefault();
      }
    },
    [],
  );

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
            <Title level={3}>{t('Tell us more about yourself')}</Title>
            <Paragraph type="secondary">
              {t(
                'All the data is from Dodo IS. Please enter your team or role. It helps to proceed your request.',
              )}
            </Paragraph>
            <Form
              name="stepOne"
              onFinish={onNextStep}
              autoComplete="off"
              layout="vertical"
            >
              <Row gutter={16}>
                <Col span={12}>
                  <FormItem
                    label={t('First name')}
                    name="firstName"
                    initialValue={firstName}
                  >
                    <Input disabled />
                  </FormItem>
                </Col>

                <Col span={12}>
                  <FormItem
                    label={t('Last name')}
                    name="lastName"
                    initialValue={lastName}
                  >
                    <Input disabled />
                  </FormItem>
                </Col>
              </Row>
              <Row>
                <Col span={24}>
                  <FormItem label="email" name="email" initialValue={email}>
                    <Input disabled />
                  </FormItem>
                </Col>
              </Row>
              <Row>
                <Col span={24}>
                  <FormItem
                    label={t('Role in Dodo Brands')}
                    name="DodoRole"
                    rules={[
                      {
                        required: true,
                        message: t('Please input your role in Dodo Brands!'),
                      },
                      {
                        min: 3,
                        message: t('Minimum 3 characters'),
                      },
                      {
                        max: 30,
                        message: t('Maximum 30 characters'),
                      },
                    ]}
                    initialValue=""
                  >
                    <Input onKeyPress={handleRoleKeyPress} />
                  </FormItem>
                </Col>
              </Row>
              <ButtonWithTopMargin type="primary" htmlType="submit">
                {t('Next step')}
              </ButtonWithTopMargin>
            </Form>
          </Col>

          <Col span={10}>
            <img
              src="/static/assets/images/onBoardingStepOne.png"
              alt="onBoardingStepOne"
              width="100%"
            />
          </Col>
        </Row>
      </Wrapper>
      {isUpdating && <Loading />}
    </Modal>
  );
};
