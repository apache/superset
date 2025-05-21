import { useTheme } from '@superset-ui/core';
import { OutPortal } from 'react-reverse-portal';
import { FC } from 'react';
import Icons from 'src/components/Icons';
import { Button, Skeleton } from 'src/components';
import Popover from 'src/components/Popover';

type Props = {
  show: boolean;
};

const AIAssistantModal: FC<Props> = ({ portalNode }) => {
  const theme = useTheme();
  return (
    <Popover
      title="AI Assistant"
      trigger="click"
      placement="bottomLeft"
      content={<OutPortal node={portalNode} />}
    >
      <Button
        icon={
          <Icons.BulbOutlined
            iconSize="s"
            iconColor={theme.colors.primary.dark1}
          />
        }
      >
        AI Assistant
      </Button>
    </Popover>
  );
};

export default AIAssistantModal;
