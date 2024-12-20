import Icons from 'src/components/Icons';
import Label from 'src/components/Label';
import { t } from '@superset-ui/core';

const PublishedLabel = ({ isPublished, onClick }) => {
  const label = isPublished ? t('Published') : t('Draft');
  const icon = isPublished ? (
    <Icons.CircleCheck iconSize="s" />
  ) : (
    <Icons.Minus iconSize="s" />
  );
  const labelType = isPublished ? 'success' : 'alert';

  return (
    <Label type={labelType} icon={icon} onClick={onClick}>
      {label}
    </Label>
  );
};
export default PublishedLabel;
