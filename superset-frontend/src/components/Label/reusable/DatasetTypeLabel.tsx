import Icons from 'src/components/Icons';
import Label from 'src/components/Label';
import { t } from '@superset-ui/core';

const SIZE = 's';
interface DatasetTypeLabelProps {
  datasetType: 'physical' | 'virtual';
}

const DatasetTypeLabel = ({ datasetType }) => {
  const label = datasetType === 'physical' ? t('Physical') : t('Virtual');
  const icon =
    datasetType === 'physical' ? (
      <Icons.Table iconSize={SIZE} />
    ) : (
      <Icons.ConsoleSqlOutlined iconSize={SIZE} />
    );
  const labelType = datasetType === 'physical' ? 'primary' : 'success';
  return (
    <Label icon={icon} type={labelType}>
      {label}
    </Label>
  );
};

export default DatasetTypeLabel;
