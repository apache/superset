import { styled } from '@superset-ui/core';
import { Card } from 'antd';
import Icons from 'src/components/Icons';
import LinesEllipsis from 'react-lines-ellipsis';

export interface IconCardProps {
  title: string;
  icon?: string;
  altText?: string;
}

const StyledCard = styled(Card)`
  text-align: center;
  width: 100%;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  
  .ant-card-body {
    padding: ${({ theme }) => theme.gridUnit * 4}px;
  }
`;

const StyledImage = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;

  img {
    width: ${({ theme }) => theme.gridUnit * 10}px;
    height: ${({ theme }) => theme.gridUnit * 10}px;
  }

  .default-icon {
    font-size: 36px;
    color: ${({ theme }) => theme.colors.grayscale.base};
  }
`;

const IconCard = ({ title, icon, altText, ...props }: IconCardProps) => (
  <StyledCard {...props}>
    <StyledImage>
      {icon ? <img src={icon} alt={altText} /> : <Icons.DatabaseOutlined className="default-icon" />}
    </StyledImage>
    <LinesEllipsis text={title} maxLine="2" basedOn="words" trimRight />
  </StyledCard>
);

export default IconCard;
