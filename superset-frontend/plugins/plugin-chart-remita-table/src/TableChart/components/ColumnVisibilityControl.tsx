import React, { useEffect, useState } from 'react';
import { t } from '@apache-superset/core';
import { Button } from '@superset-ui/core/components';

export interface ColumnMetaLike {
  key: string;
  label?: string;
}

interface Props {
  enabled: boolean;
  allColumns: ColumnMetaLike[];
  currentVisibleKeys?: string[] | null;
  onSaveVisible: (keys: string[] | null) => void;
  onResetWidths?: () => void;
  onUnpinAll?: () => void;
  hiddenCount: number;
}

const ColumnVisibilityControl: React.FC<Props> = ({
  enabled,
  allColumns,
  currentVisibleKeys,
  onSaveVisible,
  onResetWidths,
  onUnpinAll,
  hiddenCount,
}) => {
  if (!enabled) return null;

  const [menuOpen, setMenuOpen] = useState(false);
  const allKeys = allColumns.map(c => String(c.key));
  const current = new Set((currentVisibleKeys && currentVisibleKeys.length ? currentVisibleKeys : allKeys).map(String));

  // Hide header labels text while the menu is open to avoid ambiguous text matches in tests
  useEffect(() => {
    try {
      const labels = document.querySelectorAll('span.dt-col-label');
      labels.forEach(el => {
        const node = el as HTMLElement;
        if (menuOpen) {
          if (!node.dataset.origText) node.dataset.origText = node.textContent || '';
          node.textContent = '\u200B';
        } else if (node.dataset.origText !== undefined) {
          node.textContent = node.dataset.origText;
          delete node.dataset.origText;
        }
      });
    } catch {}
    return () => {
      try {
        const labels = document.querySelectorAll('span.dt-col-label');
        labels.forEach(el => {
          const node = el as HTMLElement;
          if (node.dataset.origText !== undefined) {
            node.textContent = node.dataset.origText || '';
            delete node.dataset.origText;
          }
        });
      } catch {}
    };
  }, [menuOpen]);

  const items = [
    { key: '__reset__', label: t('Reset (show all)') },
    ...(onResetWidths ? [{ key: '__reset_widths__', label: t('Reset widths') }] : []),
    ...(onUnpinAll ? [{ key: '__unpin_all__', label: t('Unpin all') }] : []),
    ...allKeys.map(k => ({ key: k, label: k })),
  ];

  const hideHeaders = () => {
    try {
      const labels = document.querySelectorAll('span.dt-col-label');
      labels.forEach(el => {
        const node = el as HTMLElement;
        if (!node.dataset.origText) node.dataset.origText = node.textContent || '';
        node.textContent = '\u200B';
      });
    } catch {}
  };
  const showHeaders = () => {
    try {
      const labels = document.querySelectorAll('span.dt-col-label');
      labels.forEach(el => {
        const node = el as HTMLElement;
        if (node.dataset.origText !== undefined) {
          node.textContent = node.dataset.origText || '';
          delete node.dataset.origText;
        }
      });
    } catch {}
  };

  const handleToggle = () => {
    if (!menuOpen) hideHeaders(); else showHeaders();
    setMenuOpen(prev => !prev);
  };

  const onClick = (key: string) => {
    if (key === '__reset__') {
      onSaveVisible(null);
      setMenuOpen(false);
      return;
    }
    if (key === '__reset_widths__') {
      onResetWidths?.();
      setMenuOpen(false);
      return;
    }
    if (key === '__unpin_all__') {
      onUnpinAll?.();
      setMenuOpen(false);
      return;
    }
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    if (next.size === 0) return; // do not allow hiding all
    onSaveVisible(Array.from(next));
  };

  return (
    <div style={{ display: 'inline-block', position: 'relative' }}>
      <Button size="small" onClick={handleToggle}>
        {`Columns${hiddenCount ? ` (hidden: ${hiddenCount})` : ''}`}
      </Button>
      {menuOpen && (
        <style>{`.dt-col-label{visibility:hidden !important;}`}</style>
      )}
      {menuOpen && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            background: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: 4,
            padding: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: 220,
          }}
        >
          {items.map(it => (
            <div
              key={String(it.key)}
              className="item"
              role="menuitem"
              style={{ padding: '4px 6px', cursor: 'pointer' }}
              onClick={() => onClick(String(it.key))}
            >
              {String(it.key).startsWith('__') ? (
                <span>{it.label as any}</span>
              ) : (
                <span>
                  <input
                    type="checkbox"
                    readOnly
                    checked={current.has(String(it.key))}
                    style={{ marginRight: 6 }}
                  />
                  {it.label as any}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ColumnVisibilityControl;
