import React, { useRef } from 'react';
import { useDispatch } from 'react-redux';
import useOnClickOutside from '../hooks/useOnClickOutsite';
import { useAppSelector } from '../hooks/useAppSelector';
import { closeModal } from '../dvt-redux/dvt-modalReducer';
import DvtDashboardEdit from './body/dashboard-edit';
import {
  StyledModal,
  StyledModalCard,
  StyledModalCardBody,
  StyledModalCardClose,
} from './dvt-modal.module';

export interface ModalProps {
  meta: any;
  onClose: () => void;
}

const getComponent = (cmpnt: string, meta: any, onClose: () => void) => {
  switch (cmpnt) {
    case 'edit-dashboard':
      return <DvtDashboardEdit meta={meta} onClose={onClose} />;
    default:
      return <></>;
  }
};

const DvtModal = () => {
  const dispatch = useDispatch();
  const component = useAppSelector(state => state.dvtModal.component);
  const meta = useAppSelector(state => state.dvtModal.meta);
  const ref = useRef<HTMLDivElement | null>(null);
  const handleCloseModal = () => dispatch(closeModal());
  useOnClickOutside(ref, () => handleCloseModal());

  const size = (() => {
    switch (component) {
      case 'add-alert':
        return 'medium';
      default:
        return 'small';
    }
  })();

  return component ? (
    <StyledModal>
      <StyledModalCard size={size} ref={ref}>
        <StyledModalCardClose onClick={() => handleCloseModal()}>
          X
        </StyledModalCardClose>
        <StyledModalCardBody>
          {getComponent(component, meta, handleCloseModal)}
        </StyledModalCardBody>
      </StyledModalCard>
    </StyledModal>
  ) : (
    <></>
  );
};

export default DvtModal;
