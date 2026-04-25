import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border-primary/80 bg-primary text-primary-foreground shadow-[0_10px_25px_-15px_hsl(var(--primary))] hover:border-primary hover:bg-primary/95',
        outline:
          'border-input bg-background/88 text-foreground shadow-[0_8px_24px_-18px_rgba(15,23,42,0.28)] hover:border-foreground/12 hover:bg-accent/80 hover:text-accent-foreground',
        ghost: 'border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-accent/70 hover:text-foreground'
      },
      size: {
        default: 'h-10 px-4 py-2.5',
        sm: 'h-9 px-3.5 text-xs',
        lg: 'h-11 px-5 text-sm'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
