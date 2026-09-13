import { cn } from "@rox/ui/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("animate-pulse rounded-none bg-muted", className)}
			data-slot="skeleton"
			{...props}
		/>
	);
}

export { Skeleton };
