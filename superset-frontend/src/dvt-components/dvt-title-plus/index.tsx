import { StyledDvtTitlePlus } from './dvt-title-plus.module';

export interface DvtTitlePlusProps {
  title: string;
}

const DvtTitlePlus: React.FC<DvtTitlePlusProps> = ({ title = '' }) => (
  <StyledDvtTitlePlus>{title}</StyledDvtTitlePlus>
);

export default DvtTitlePlus;
