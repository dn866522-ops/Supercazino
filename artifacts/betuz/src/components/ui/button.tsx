import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "gold" | "danger" | "success";
  size?: "sm" | "default" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none active:scale-95";
    
    const variants = {
      default: "bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5",
      gold: "gold-gradient text-black shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:-translate-y-0.5",
      success: "bg-success text-white shadow-lg shadow-success/25 hover:shadow-success/40 hover:-translate-y-0.5",
      danger: "bg-destructive text-white shadow-lg shadow-destructive/25 hover:shadow-destructive/40",
      outline: "border-2 border-border bg-transparent hover:border-primary/50 text-foreground",
      ghost: "bg-transparent hover:bg-white/5 text-foreground",
    };

    const sizes = {
      sm: "h-9 px-4 text-sm",
      default: "h-12 px-6",
      lg: "h-14 px-8 text-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
