import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  trend,
  iconBg = "bg-accent-dato/30",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  trend?: { value: string; positive: boolean };
  iconBg?: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-card">
      <CardContent className="flex items-center gap-3 p-3 sm:gap-3.5 sm:p-4">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12", iconBg)}>
          <Icon className="h-5 w-5 text-text-primary sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold leading-tight">{value}</p>
            {trend && (
              <span
                className={cn(
                  "text-xs font-medium",
                  trend.positive ? "text-green-600 dark:text-green-400" : "text-destructive"
                )}
              >
                {trend.positive ? "↑" : "↓"} {trend.value}
              </span>
            )}
          </div>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
