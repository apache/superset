export const UPDATE_COMPONENTS = 'UPDATE_COMPONENTS';
export function updateComponents(nextComponents) {
  return {
    type: UPDATE_COMPONENTS,
    payload: {
      nextComponents,
    },
  };
}

export const DELETE_COMPONENT = 'DELETE_COMPONENT';
export function deleteComponent(id, parentId) {
  return {
    type: DELETE_COMPONENT,
    payload: {
      id,
      parentId,
    },
  };
}

export const CREATE_COMPONENT = 'CREATE_COMPONENT';
export function createComponent(dropResult) {
  return {
    type: CREATE_COMPONENT,
    payload: {
      dropResult,
    },
  };
}


// Drag and drop --------------------------------------------------------------
export const MOVE_COMPONENT = 'MOVE_COMPONENT';
export function moveComponent(dropResult) {
  return {
    type: MOVE_COMPONENT,
    payload: {
      dropResult,
    },
  };
}

export const HANDLE_COMPONENT_DROP = 'HANDLE_COMPONENT_DROP';
export function handleComponentDrop(dropResult) {
  return (dispatch) => {
    if (
      dropResult.destination
      && dropResult.source
      && !( // ensure it has moved
        dropResult.destination.droppableId === dropResult.source.droppableId
        && dropResult.destination.index === dropResult.source.index
      )
    ) {
      return dispatch(moveComponent(dropResult));

      // new components don't have a source
    } else if (dropResult.destination && !dropResult.source) {
      return dispatch(createComponent(dropResult));
    }
    return null;
  };
}

// Resize ---------------------------------------------------------------------

// export function dashboardComponentResizeStart() {}
// export function dashboardComponentResize() {}
// export function dashboardComponentResizeStop() {}
