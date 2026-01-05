import * as React from "react";

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

  const handleToggle = () => {
    const newOpen = !actualOpen;
    if (!controlled) setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  return (
    <div className="relative">
      <div onClick={handleToggle}>{children}</div>
      {actualOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={handleToggle}
          />
          <div className="absolute right-0 top-full mt-2 z-50 rounded-lg bg-slate-900/95 backdrop-blur-md p-3 shadow-xl border border-slate-700">
            {content}
          </div>
        </>
      )}
    </div>
  );
}
