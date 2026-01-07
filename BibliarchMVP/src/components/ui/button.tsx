import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 rounded-md",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 rounded-md",
        outline:
          "border bg-background text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 rounded-md",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80 rounded-md",
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md",
        link: "text-primary underline-offset-4 hover:underline",
        // Liquid Glass variants - dark, translucent, subtle
        liquid:
          "rounded-full bg-slate-900/75 dark:bg-slate-900/80 backdrop-blur-md text-white border border-white/10 hover:bg-slate-900/85 dark:hover:bg-slate-900/90 active:scale-[0.97]",
        "liquid-secondary":
          "rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-900 dark:text-white border border-black/5 dark:border-white/10 hover:bg-white/90 dark:hover:bg-slate-800/90 active:scale-[0.97]",
        "liquid-ghost":
          "rounded-full bg-transparent text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.97]",
        "liquid-destructive":
          "rounded-full bg-red-600/90 backdrop-blur-md text-white border border-red-500/20 hover:bg-red-600 active:scale-[0.97]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        icon: "size-9",
        // Liquid Glass sizes - slightly smaller
        "liquid-sm": "h-7 px-3 text-xs",
        "liquid-default": "h-8 px-4",
        "liquid-lg": "h-9 px-5",
        "liquid-icon": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
