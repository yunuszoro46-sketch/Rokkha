import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-base font-semibold ring-offset-background transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rk-forest focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        default:
          "bg-rk-forest text-white hover:bg-rk-forest/90 shadow-sm",
        secondary:
          "bg-white text-rk-forest border border-rk-line hover:bg-rk-page shadow-sm",
        outline:
          "border border-rk-line bg-transparent hover:bg-white text-rk-forest",
        ghost:
          "hover:bg-rk-secondary/60 text-rk-forest",
        pill:
          "rounded-full bg-rk-forest text-white hover:bg-rk-forest/90 shadow-sm",
        pillOutline:
          "rounded-full border border-rk-line bg-white text-rk-forest hover:bg-rk-page",
        alert:
          "bg-rk-danger text-white hover:bg-rk-danger/90 shadow-sm",
        watch:
          "bg-rk-warning-accent text-white hover:bg-rk-warning shadow-sm",
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
