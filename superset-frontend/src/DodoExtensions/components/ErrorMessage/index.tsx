import { styled, t } from '@superset-ui/core';

const Wrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  max-width: 1350px;
  margin: auto;
  width: 100%;
  padding: 56px;
  color: ${({ theme }) => theme.colors.primary.base};

  h2 {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    font-size: 88px;
    margin: 0;
  }

  p {
    font-weight: ${({ theme }) => theme.typography.weights.medium};
    font-size: 24px;
    line-height: 40px;
    width: 490px;
  }
`;

const ErrorMessage = () => (
  <Wrapper>
    <section>
      <h2>{t('Service temporarily unavailable')}</h2>
      <p>
        {t(
          'Sorry, something went wrong. We are fixing the mistake now. Try again later.',
        )}
      </p>
    </section>
  </Wrapper>
);

export default ErrorMessage;
