import React, { useRef } from 'react';
import { useDispatch } from 'react-redux';
import DvtButton from 'src/components/DvtButton';
import useOnClickOutside from '../hooks/useOnClickOutsite';
import { useAppSelector } from '../hooks/useAppSelector';
import { closeModal } from '../dvt-redux/dvt-modalReducer';
import {
  StyledModal,
  StyledModalCard,
  StyledModalCardBody,
  StyledModalCardClose,
  StyledModalCardTitle,
} from './dvt-modal.module';

export interface ModalProps {
  meta?: any;
  closeModal: () => void | undefined;
  size?: 'small' | 'medium';
}

const getComponent = (cmpnt: string, meta: any, closeModal: () => void) => {
  switch (cmpnt) {
    default:
      return <></>;
  }
};
const DvtModal: React.FC<ModalProps> = ({ size = 'medium' }) => {
  const dispatch = useDispatch();
  const ref = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(ref, () => handleCloseModal());

  const component = useAppSelector(state => state.modal.component);
  const title = useAppSelector(state => state.modal.title);
  const buttonLabel = useAppSelector(state => state.modal.buttonLabel);
  const buttonOnClick = useAppSelector(state => state.modal.buttonOnClick);
  const meta = useAppSelector(state => state.modal.meta);

  const handleCloseModal = () => {
    dispatch(closeModal());
  };

  return component ? (
    <StyledModal>
      <StyledModalCard size={size} ref={ref}>
        <StyledModalCardClose onClick={() => handleCloseModal()}>
          X
        </StyledModalCardClose>
        {title && <StyledModalCardTitle>{title}</StyledModalCardTitle>}
        {buttonLabel && (
          <DvtButton
            bold
            colour="primary"
            icon="dvt-add_square"
            label={buttonLabel}
            onClick={buttonOnClick}
            size="medium"
            typeColour="powder"
          />
        )}
        <StyledModalCardBody>
          {getComponent(component, meta, () => handleCloseModal())}
        </StyledModalCardBody>
      </StyledModalCard>
    </StyledModal>
  ) : (
    <></>
  );
};

export default DvtModal;
