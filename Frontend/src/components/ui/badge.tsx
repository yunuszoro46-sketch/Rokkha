import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-base font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-rk-forest focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-rk-forest text-rk-page shadow hover:bg-rk-forest",
        secondary:
          "border-transparent bg-rk-page text-rk-forest hover:bg-rk-sand",
        outline:
          "border-rk-line text-rk-forest bg-white",
        alert:
          "border-rk-danger-accent/30 bg-rk-danger-accent/15 text-rk-danger",
        watch:
          "border-rk-warning-accent/30 bg-rk-warning-accent/15 text-rk-warning",
        none:
          "border-rk-moss/30 bg-rk-moss/20 text-rk-forest",
        unsupported:
          "border-gray-300 bg-gray-100 text-gray-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
