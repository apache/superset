import throttle from 'lodash.throttle';
import getDropPosition, { DROP_TOP, DROP_RIGHT, DROP_BOTTOM, DROP_LEFT } from '../../util/getDropPosition';

const HOVER_THROTTLE_MS = 200;

function handleHover(props, monitor, Component) {
  // this may happen due to throttling
  if (!Component.mounted) return;

  const dropPosition = getDropPosition(monitor, Component);

  if (!dropPosition) {
    Component.setState(() => ({ dropIndicator: null }));
    return;
  }

  // @TODO
  // drop-indicator
  // drop-indicator--top/right/bottom/left
  Component.setState(() => ({
    dropIndicator: {
      top: dropPosition === DROP_BOTTOM ? '100%' : 0,
      left: dropPosition === DROP_RIGHT ? '100%' : 0,
      height: dropPosition === DROP_LEFT || dropPosition === DROP_RIGHT ? '100%' : 3,
      width: dropPosition === DROP_TOP || dropPosition === DROP_BOTTOM ? '100%' : 3,
      minHeight: dropPosition === DROP_LEFT || dropPosition === DROP_RIGHT ? 16 : null,
      minWidth: dropPosition === DROP_TOP || dropPosition === DROP_BOTTOM ? 16 : null,
      margin: 'auto',
      backgroundColor: '#44C0FF',
      position: 'absolute',
      zIndex: 10,
    },
  }));
}

// this is called very frequently by react-dnd
export default throttle(handleHover, HOVER_THROTTLE_MS);
