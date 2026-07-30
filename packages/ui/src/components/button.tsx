// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { cn } from "@rox-apps/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useMemo,
} from "react";

export type ButtonVariant =
  | "alt-action"
  | "default"
  | "destructive"
  | "ghost"
  | "link"
  | "outline"
  | "secondary"
  | "success";

export type ButtonSize =
  | "default"
  | "icon"
  | "icon-lg"
  | "icon-sm"
  | "icon-xs"
  | "lg"
  | "sm"
  | "xs";

export interface ButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    | "ref"
    | "onDrag"
    | "onDragEnd"
    | "onDragStart"
    | "onAnimationEnd"
    | "onAnimationStart"
  > {
  asChild?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50",
  outline:
    "border border-border bg-background text-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring/50",
  ghost:
    "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
  destructive:
    "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-2 focus-visible:ring-destructive/30",
  success:
    "bg-success/10 text-success hover:bg-success/20 focus-visible:ring-2 focus-visible:ring-success/30",
  "alt-action":
    "bg-alt-action/10 text-alt-action hover:bg-alt-action/20 focus-visible:ring-2 focus-visible:ring-alt-action/30",
  link: "text-primary underline-offset-4 hover:underline",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-9 gap-2 px-4 text-xs",
  xs: "h-6 gap-1 rounded-md px-2 text-xs",
  sm: "h-7 gap-1.5 rounded-md px-2.5 text-xs",
  lg: "h-10 gap-2 rounded-lg px-5 text-sm",
  icon: "size-9 rounded-md",
  "icon-xs": "size-6 rounded-md",
  "icon-sm": "size-7 rounded-md",
  "icon-lg": "size-10 rounded-md",
};

const pressSpring = {
  damping: 30,
  mass: 0.6,
  stiffness: 500,
  type: "spring",
} as const;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      asChild,
      children,
      className,
      disabled,
      size = "default",
      type = "button",
      variant = "default",
      ...props
    },
    ref
  ) {
    const reduceMotion = useReducedMotion();

    const isIcon =
      size === "icon" ||
      size === "icon-xs" ||
      size === "icon-sm" ||
      size === "icon-lg";

    const classes = useMemo(
      () =>
        cn(
          "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium text-xs outline-none transition-colors",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className
        ),
      [variant, size, className]
    );

    const canScale = !(reduceMotion || disabled);
    const hoverProps = canScale && !isIcon ? { scale: 1.02 } : undefined;
    const tapProps = canScale ? { scale: 0.95 } : undefined;

    if (asChild && isValidElement(children)) {
      const child = Children.only(children);
      return cloneElement(child, {
        className: cn(
          classes,
          (child.props as { className?: string }).className
        ),
        "data-slot": "button",
        ref,
      } as Record<string, unknown>);
    }

    return (
      <motion.button
        className={classes}
        data-slot="button"
        disabled={disabled}
        ref={ref}
        transition={pressSpring}
        type={type}
        whileHover={hoverProps}
        whileTap={tapProps}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
