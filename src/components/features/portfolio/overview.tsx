import { EnhancedOverview } from "./enhanced-overview";

interface OverviewProps {
  walletAddress: string;
}

export function Overview({ walletAddress }: OverviewProps) {
  if (!EnhancedOverview) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">Overview component unavailable. Rendering basic view.</div>
      </div>
    )
  }
  return <EnhancedOverview walletAddress={walletAddress} />;
}