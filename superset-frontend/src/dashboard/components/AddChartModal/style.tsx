import { css, styled } from '@superset-ui/core';

export const ModalContent = styled.div`
  ${({ theme }) => css`
    display: flex;
    height: 80vh;
    max-height: 800px;

    .left-panel {
      flex: 1;
      padding: ${theme.sizeUnit * 6}px;
      border-right: 1px solid ${theme.colorBorderSecondary};
      overflow-y: auto;

      .form-section {
        margin-bottom: ${theme.sizeUnit * 6}px;

        .section-title {
          font-size: ${theme.fontSize}px;
          font-weight: ${theme.fontWeightStrong};
          color: ${theme.colorText};
          margin-bottom: ${theme.sizeUnit * 3}px;
        }

        .viz-type-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: ${theme.sizeUnit * 2}px;
          margin-bottom: ${theme.sizeUnit * 3}px;

          .viz-button {
            padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
            border: 1px solid ${theme.colorBorderSecondary};
            border-radius: ${theme.borderRadius}px;
            background: ${theme.colorBgContainer};
            color: ${theme.colorText};
            cursor: pointer;
            font-size: ${theme.fontSizeSM}px;
            transition: all 0.2s ease;

            &:hover {
              border-color: ${theme.colors.primary.base};
            }

            &.active {
              background: ${theme.colors.primary.base};
              color: ${theme.colorWhite};
              border-color: ${theme.colors.primary.base};
            }
          }
        }

        .form-field {
          margin-bottom: ${theme.sizeUnit * 4}px;

          label {
            display: block;
            font-size: ${theme.fontSizeSM}px;
            font-weight: ${theme.fontWeightNormal};
            color: ${theme.colorText};
            margin-bottom: ${theme.sizeUnit}px;
          }

          input,
          textarea {
            width: 100%;
            padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
            border: 1px solid ${theme.colorBorderSecondary};
            border-radius: ${theme.borderRadius}px;
            font-size: ${theme.fontSizeSM}px;
            color: ${theme.colorText};
            background: ${theme.colorBgContainer};

            &:focus {
              outline: none;
              border-color: ${theme.colors.primary.base};
            }
          }

          textarea {
            min-height: 80px;
            resize: vertical;
          }

          /* Select Styling */
          .select-container {
            .Select__control {
              min-height: ${theme.controlHeight}px;
              padding: 0;
              border: 1px solid ${theme.colorBorderSecondary};
              border-radius: ${theme.borderRadius}px;
              background: ${theme.colorBgContainer};
              box-shadow: none;
              transition: border-color 0.2s ease;

              &:hover {
                border-color: ${theme.colors.primary.base};
              }

              &--is-focused {
                border-color: ${theme.colors.primary.base};
                box-shadow: 0 0 0 2px ${theme.colors.primary.light4};
              }

              &--menu-is-open {
                border-color: ${theme.colors.primary.base};
              }
            }

            .Select__value-container {
              padding: 0 ${theme.sizeUnit * 3}px;

              .Select__placeholder {
                color: ${theme.colorTextPlaceholder};
                font-size: ${theme.fontSizeSM}px;
              }

              .Select__single-value {
                color: ${theme.colorText};
                font-size: ${theme.fontSizeSM}px;
              }

              .Select__input-container {
                color: ${theme.colorText};
                font-size: ${theme.fontSizeSM}px;
              }
            }

            .Select__indicators {
              .Select__dropdown-indicator {
                padding: ${theme.sizeUnit * 2}px;
                color: ${theme.colorTextSecondary};

                &:hover {
                  color: ${theme.colorText};
                }
              }

              .Select__clear-indicator {
                padding: ${theme.sizeUnit * 2}px;
                color: ${theme.colorTextSecondary};

                &:hover {
                  color: ${theme.colorText};
                }
              }

              .Select__loading-indicator {
                padding: ${theme.sizeUnit * 2}px;
              }
            }

            .Select__menu {
              background: ${theme.colorBgContainer};
              border: 1px solid ${theme.colorBorderSecondary};
              border-radius: ${theme.borderRadius}px;
              box-shadow: ${theme.boxShadow};
              z-index: 1000;

              .Select__menu-list {
                padding: ${theme.sizeUnit}px 0;

                .Select__option {
                  padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
                  font-size: ${theme.fontSizeSM}px;
                  color: ${theme.colorText};
                  background: transparent;
                  cursor: pointer;

                  &:hover,
                  &--is-focused {
                    background: ${theme.colors.primary.light5};
                    color: ${theme.colorText};
                  }

                  &--is-selected {
                    background: ${theme.colors.primary.base};
                    color: ${theme.colorWhite};

                    &:hover {
                      background: ${theme.colors.primary.dark1};
                    }
                  }
                }

                .Select__no-options-message {
                  padding: ${theme.sizeUnit * 3}px;
                  color: ${theme.colorTextSecondary};
                  font-size: ${theme.fontSizeSM}px;
                  text-align: center;
                }

                .Select__loading-message {
                  padding: ${theme.sizeUnit * 3}px;
                  color: ${theme.colorTextSecondary};
                  font-size: ${theme.fontSizeSM}px;
                  text-align: center;
                }
              }
            }
          }
        }
      }
    }

    .right-panel {
      flex: 1;
      padding: ${theme.sizeUnit * 6}px;
      background: ${theme.colors.grayscale.light5};
      display: flex;
      flex-direction: column;

      .preview-title {
        font-size: ${theme.fontSize}px;
        font-weight: ${theme.fontWeightStrong};
        color: ${theme.colorText};
        margin-bottom: ${theme.sizeUnit * 4}px;
      }

      .chart-preview {
        flex: 1;
        background: ${theme.colorBgContainer};
        border: 1px solid ${theme.colorBorderSecondary};
        border-radius: ${theme.borderRadius}px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: ${theme.sizeUnit * 4}px;
        min-height: 300px;

        .preview-chart {
          display: flex;
          align-items: flex-end;
          gap: ${theme.sizeUnit * 2}px;
          height: 150px;

          .bar {
            width: 40px;
            background: ${theme.colors.primary.base};
            border-radius: ${theme.borderRadiusXS}px ${theme.borderRadiusXS}px 0
              0;

            &:nth-child(1) {
              height: 80px;
            }
            &:nth-child(2) {
              height: 60px;
            }
            &:nth-child(3) {
              height: 100px;
            }
            &:nth-child(4) {
              height: 45px;
            }
            &:nth-child(5) {
              height: 120px;
            }
          }
        }

        .preview-line-chart {
          width: 200px;
          height: 120px;
          position: relative;

          svg {
            width: 100%;
            height: 100%;

            .line {
              stroke: ${theme.colors.primary.base};
              stroke-width: 3;
              fill: none;
            }

            .dot {
              fill: ${theme.colors.primary.base};
            }
          }
        }

        .preview-pie-chart {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: conic-gradient(
            ${theme.colors.primary.base} 0deg 120deg,
            ${theme.colors.primary.light2} 120deg 200deg,
            ${theme.colors.primary.light3} 200deg 280deg,
            ${theme.colors.primary.light4} 280deg 360deg
          );
        }

        .preview-table {
          .table-header {
            display: flex;
            background: ${theme.colors.grayscale.light4};
            border-radius: ${theme.borderRadius}px ${theme.borderRadius}px 0 0;

            .header-cell {
              flex: 1;
              padding: ${theme.sizeUnit * 2}px;
              font-weight: ${theme.fontWeightStrong};
              border-right: 1px solid ${theme.colorBorderSecondary};

              &:last-child {
                border-right: none;
              }
            }
          }

          .table-row {
            display: flex;
            border-bottom: 1px solid ${theme.colorBorderSecondary};

            .table-cell {
              flex: 1;
              padding: ${theme.sizeUnit * 2}px;
              border-right: 1px solid ${theme.colorBorderSecondary};

              &:last-child {
                border-right: none;
              }
            }
          }
        }

        .no-datasource-message {
          text-align: center;
          color: ${theme.colorTextSecondary};
          font-style: italic;
        }
      }

      .config-summary {
        .summary-title {
          font-size: ${theme.fontSizeSM}px;
          font-weight: ${theme.fontWeightStrong};
          color: ${theme.colorText};
          margin-bottom: ${theme.sizeUnit * 2}px;
        }

        .summary-item {
          font-size: ${theme.fontSizeSM}px;
          color: ${theme.colorTextSecondary};
          margin-bottom: ${theme.sizeUnit}px;

          strong {
            color: ${theme.colorText};
          }
        }
      }
    }

    .modal-footer {
      position: absolute;
      bottom: 0;
      right: 0;
      padding: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 6}px;
      background: ${theme.colorBgContainer};
      border-top: 1px solid ${theme.colorBorderSecondary};
      display: flex;
      gap: ${theme.sizeUnit * 3}px;

      button {
        padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
        border-radius: ${theme.borderRadius}px;
        font-size: ${theme.fontSizeSM}px;
        cursor: pointer;
        border: 1px solid transparent;

        &.cancel-btn {
          background: ${theme.colors.grayscale.light4};
          color: ${theme.colorText};
          border-color: ${theme.colorBorderSecondary};

          &:hover {
            background: ${theme.colors.grayscale.light3};
          }
        }

        &.save-btn {
          background: ${theme.colors.primary.base};
          color: ${theme.colorWhite};

          &:hover {
            background: ${theme.colors.primary.dark1};
          }

          &:disabled {
            background: ${theme.colors.grayscale.light3};
            cursor: not-allowed;
          }
        }
      }
    }
  `}
`;
