import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-base font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#263B32] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[#20362B] text-white hover:bg-[#16271E] shadow-sm",
        secondary:
          "bg-white text-[#1A2820] border border-[#D5D2C8] hover:bg-[#FAFAF7] shadow-sm",
        outline:
          "border border-[#D5D2C8] bg-transparent hover:bg-white text-[#1A2820]",
        ghost:
          "hover:bg-[#EDEBE2]/60 text-[#263B32]",
        pill:
          "rounded-full bg-[#20362B] text-white hover:bg-[#16271E] shadow-sm",
        pillOutline:
          "rounded-full border border-[#D5D2C8] bg-white text-[#1A2820] hover:bg-[#FAFAF7]",
        alert:
          "bg-[#B94A48] text-white hover:bg-[#a33e3c] shadow-sm",
        watch:
          "bg-[#C69A50] text-white hover:bg-[#b08742] shadow-sm",
      },
      size: {
        default: "h-11 px-5 py-2.5 rounded-xl text-base",
        sm: "h-10 px-4 rounded-lg text-base",
        lg: "h-12 px-6 rounded-xl text-base",
        pill: "h-11 px-6 rounded-full text-base",
        icon: "h-11 w-11 rounded-xl text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
