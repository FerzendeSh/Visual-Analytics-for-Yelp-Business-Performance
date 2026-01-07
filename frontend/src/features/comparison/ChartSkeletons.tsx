import { Skeleton } from "../../components/ui/skeleton";

export function MetricsCardsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass rounded-lg p-4">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ title }: { title?: string }) {
  return (
    <div className="glass rounded-lg p-4 h-full flex flex-col">
      <div className="mb-4">
        {title ? (
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        ) : (
          <Skeleton className="h-6 w-48 mb-2" />
        )}
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="flex-1 flex flex-col justify-between py-4">
        {/* Y-axis labels */}
        <div className="flex justify-between items-center">
          <Skeleton className="h-3 w-8" />
          <div className="flex-1 mx-4">
            <Skeleton className="h-1 w-full" />
          </div>
        </div>

        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex justify-between items-center">
            <Skeleton className="h-3 w-8" />
            <div className="flex-1 mx-4">
              <Skeleton
                className="h-12 rounded"
                style={{ width: `${Math.random() * 40 + 60}%` }}
              />
            </div>
          </div>
        ))}

        {/* X-axis */}
        <div className="flex justify-between mt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-3 w-12" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function KeywordInsightsSkeleton() {
  return (
    <div className="glass rounded-lg p-4 h-full flex flex-col">
      <div className="mb-4">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="space-y-3 flex-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AttributesComparisonSkeleton() {
  return (
    <div className="glass rounded-lg p-4 h-full flex flex-col">
      <div className="mb-4">
        <Skeleton className="h-6 w-56 mb-2" />
        <Skeleton className="h-4 w-40" />
      </div>

      <div className="space-y-4 flex-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 flex-1 rounded" />
              <Skeleton className="h-5 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompetitivePositioningSkeleton() {
  return (
    <div className="glass rounded-lg p-4 h-full flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-4 w-16" />
          ))}
        </div>
      </div>

      <div className="flex-1 relative">
        {/* Chart area */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full p-8">
            {/* Grid of dots simulating scatter plot */}
            <div className="grid grid-cols-10 grid-rows-8 gap-4 w-full h-full">
              {Array.from({ length: 80 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-2 w-2 rounded-full"
                  style={{
                    opacity: Math.random() > 0.6 ? 0.6 : 0.2,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
