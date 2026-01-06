import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
  onClear?: () => void;
}

export function Command({ className, onSearch, onClear, value: controlledValue, ...props }: CommandProps) {
  const [internalValue, setInternalValue] = React.useState("");
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onSearch?.(newValue);
  };

  const handleClear = () => {
    if (controlledValue === undefined) {
      setInternalValue("");
    }
    onClear?.();
  };

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        className="w-full h-10 pl-10 pr-10 rounded-lg glass text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Search businesses..."
        {...props}
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 hover:text-slate-200 transition-colors"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
