import React, { useEffect } from 'react';
import { Dialogue } from './DialogueView';
import { DialogueModalProps } from './dialogueTypes';

/**
 * Centered Dialogue Modal Overlay (Zero background darkening mask, stackable)
 */
export const DialogueModal: React.FC<DialogueModalProps> = ({
  open,
  onClose,
  closeOnClickOutside = false,
  closeOnEsc = false,
  isLight = false,
  showCloseButton = false,
  zIndex = 800,
  ...dialogueProps
}) => {
  useEffect(() => {
    if (!open || !closeOnEsc || !onClose) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, closeOnEsc]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ zIndex }}
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 select-none bg-transparent pointer-events-none transition-opacity duration-200"
      onClick={(e) => {
        if (closeOnClickOutside && onClose && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full flex items-center justify-center pointer-events-auto cursor-default animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <Dialogue
          {...dialogueProps}
          isLight={isLight}
          showCloseButton={showCloseButton}
          onClose={showCloseButton ? onClose : undefined}
        />
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
