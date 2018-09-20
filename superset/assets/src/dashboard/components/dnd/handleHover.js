import throttle from 'lodash/fp/throttle';
import getDropPosition from '../../util/getDropPosition';

const HOVER_THROTTLE_MS = 100;

function handleHover(props, monitor, Component) {
  // this may happen due to throttling
  if (!Component.mounted) return;

  const dropPosition = getDropPosition(monitor, Component);

  if (!dropPosition) {
    Component.setState(() => ({ dropIndicator: null }));
    return;
  }

  Component.setState(() => ({
    dropIndicator: dropPosition,
  }));
}

// this is called very frequently by react-dnd
export default throttle(HOVER_THROTTLE_MS, handleHover);
