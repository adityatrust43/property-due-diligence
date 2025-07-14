import { cn } from "../../lib/utils";

const LoadingDots = ({ className }: { className?: string }) => {
  return (
    <div className={cn("flex items-center justify-start space-x-1.5", className)}>
      <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></div>
      <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></div>
      <div className="h-2 w-2 animate-bounce rounded-full bg-primary"></div>
    </div>
  );
};

export default LoadingDots;
