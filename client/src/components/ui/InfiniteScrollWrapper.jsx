import React, { useEffect, useRef } from "react";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";

const InfiniteScrollWrapper = ({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  children,
  className = "",
}) => {
  const loadMoreRef = useRef(null);

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className={className}>
      {children}
      {hasNextPage && (
        <div
          ref={loadMoreRef}
          className="py-6 text-center w-full flex justify-center"
        >
          {isFetchingNextPage && <LoadingSkeleton count={2} />}
        </div>
      )}
    </div>
  );
};

export default InfiniteScrollWrapper;
