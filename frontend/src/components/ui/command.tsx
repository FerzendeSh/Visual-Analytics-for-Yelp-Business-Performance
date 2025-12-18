import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
}

export function Command({ className, onSearch, ...props }: CommandProps) {
  const [value, setValue] = React.useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    onSearch?.(e.target.value);
  };

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        className="w-full h-10 pl-10 pr-4 rounded-lg glass text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Search businesses..."
        {...props}
      />
    </div>
  );
}
