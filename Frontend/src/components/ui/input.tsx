import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-lg border border-rk-line bg-rk-page px-3.5 py-2 text-base text-rk-forest shadow-sm transition-colors file:border-0 file:bg-transparent file:text-base file:font-medium placeholder:text-rk-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rk-forest disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
