import Icons from 'src/components/Icons';
import Label, { DatasetTypeLabel } from 'src/components/Label';
import { t } from '@superset-ui/core';

const DatasetTypeLabel = ({ datasetType }) => {
  const labelText = datasetType === 'physical' ? t('Physical') : t('Virtual');
  const size = 'm';
  const type = datasetType === 'physical' ? 'primary' : 'success';
  const icon =
    datasetType === 'physical' ? (
      <Icons.DatasetPhysical iconSize={size} />
    ) : (
      <Icons.ConsoleSqlOutlined iconSize={size} />
    );
  return (
    <Label icon={icon} type={type}>
      {labelText}
    </Label>
  );
};

export default DatasetTypeLabel;
