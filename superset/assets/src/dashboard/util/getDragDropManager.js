import { DragDropManager } from 'dnd-core';
import HTML5Backend from 'react-dnd-html5-backend';

let defaultManager;

// we use this method to ensure that there is a singleton of the DragDropManager
// within the app this seems to work fine, but in tests multiple are initialized
// see this issue for more details https://github.com/react-dnd/react-dnd/issues/186
// @TODO re-evaluate whether this is required when we move to jest
// the alternative is simply using an HOC like:
//  DragDropContext(HTML5Backend)(DashboardBuilder);
export default function getDragDropManager() {
  if (!defaultManager) {
    defaultManager = new DragDropManager(HTML5Backend);
  }
  return defaultManager;
}
