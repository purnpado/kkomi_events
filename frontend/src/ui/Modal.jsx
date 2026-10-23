import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export default function Modal({ open, onOpenChange, title, description, children, footer, maxWidth = '540px' }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" style={{ maxWidth }}>
          <div className="dialog-header">
            {title && <Dialog.Title className="dialog-title">{title}</Dialog.Title>}
            {description && <Dialog.Description className="dialog-desc">{description}</Dialog.Description>}
            <Dialog.Close asChild>
              <button className="dialog-close-btn" aria-label="닫기">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="dialog-body">{children}</div>

          {footer && <div className="dialog-footer">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
