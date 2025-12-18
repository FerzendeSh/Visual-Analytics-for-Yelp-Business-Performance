import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  className,
}: CheckboxProps) {
  return (
    <label className={cn("flex items-center gap-2 cursor-pointer", className)}>
      <div
        className={cn(
          "h-4 w-4 rounded border border-primary flex items-center justify-center transition-colors",
          checked ? "bg-primary" : "bg-transparent"
        )}
        onClick={() => onCheckedChange(!checked)}
      >
        {checked && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}
