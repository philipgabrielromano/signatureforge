import * as React from "react";
import { cn } from "@/lib/utils";

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" | "warning" }
>(({ className, variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(
      "relative w-full rounded-lg border p-4 text-sm",
      variant === "destructive" && "border-destructive/50 text-destructive",
      variant === "warning" && "border-amber-300 bg-amber-50 text-amber-900",
      variant === "default" && "bg-background",
      className
    )}
    {...props}
  />
));
Alert.displayName = "Alert";

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
