import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-base font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#263B32] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#263B32] text-[#FAFAF7] shadow hover:bg-[#1b2b24]",
        secondary:
          "border-transparent bg-[#EDEBE2] text-[#263B32] hover:bg-[#dedad0]",
        outline:
          "border-[#EDEBE2] text-[#263B32] bg-white",
        alert:
          "border-[#B94A48]/30 bg-[#B94A48]/15 text-[#B94A48]",
        watch:
          "border-[#C69A50]/30 bg-[#C69A50]/15 text-[#C69A50]",
        none:
          "border-[#78958A]/30 bg-[#78958A]/20 text-[#263B32]",
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
