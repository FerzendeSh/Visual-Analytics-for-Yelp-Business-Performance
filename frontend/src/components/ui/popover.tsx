import * as React from "react";
import { createPortal } from "react-dom";

interface PopoverProps {
  children: React.ReactNode;
  content: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({ children, content, open, onOpenChange }: PopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const controlled = open !== undefined;
  const actualOpen = controlled ? open : isOpen;
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null);

  const handleToggle = () => {
    const newOpen = !actualOpen;
    if (!controlled) setIsOpen(newOpen);
    onOpenChange?.(newOpen);

    // Update trigger position when opening
    if (newOpen && triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
    }
  };

  const handleClose = () => {
    if (!controlled) setIsOpen(false);
    onOpenChange?.(false);
  };

  // Update position when opening
  React.useEffect(() => {
    if (actualOpen && triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
    }
  }, [actualOpen]);

  return (
    <>
      <div className="relative" ref={triggerRef}>
        <div onClick={handleToggle}>{children}</div>
      </div>
      {actualOpen && triggerRect && createPortal(
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={handleClose}
            aria-label="Close popover"
          />
          <div
            className="fixed z-50 rounded-lg bg-slate-900/95 backdrop-blur-md p-3 shadow-xl border border-slate-700"
            style={{
              top: `${triggerRect.bottom + 8}px`,
              right: `${window.innerWidth - triggerRect.right}px`,
            }}
          >
            {content}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
