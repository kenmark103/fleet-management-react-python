/**
 * components/molecules/DetailCard.tsx
 * Card for displaying labeled data items with optional actions
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";

interface DetailItem {
  label: string;
  value: React.ReactNode;
}

interface DetailCardProps {
  title: string;
  items: DetailItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function DetailCard({
  title,
  items,
  actions,
  className,
}: DetailCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
        {actions}
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-sm font-medium text-muted-foreground">
                {item.label}
              </dt>
              <dd className="text-sm text-right sm:text-left">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}