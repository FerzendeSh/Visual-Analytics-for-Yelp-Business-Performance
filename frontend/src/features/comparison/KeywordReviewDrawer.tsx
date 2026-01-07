import { useState, useMemo, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import type { KeywordInsightsResponse } from '../../lib/api';

interface KeywordReviewDrawerProps {
  rawClusters: KeywordInsightsResponse;
}

const KeywordReviewDrawerComponent = ({ rawClusters }: KeywordReviewDrawerProps) => {
  const selectedKeyword = useAppStore((state) => state.selectedKeyword);
  const setKeyword = useAppStore((state) => state.setKeyword);

  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  // Find the cluster for the selected keyword
  const selectedCluster = useMemo(() => {
    if (!selectedKeyword) return null;

    const allClusters = [...rawClusters.complaints, ...rawClusters.praises];
    return allClusters.find(cluster =>
      cluster.keywords[0]?.[0]?.toLowerCase() === selectedKeyword.toLowerCase()
    );
  }, [selectedKeyword, rawClusters]);

  // Determine if this is a complaint or praise
  const sentiment = useMemo(() => {
    if (!selectedCluster) return null;
    return rawClusters.complaints.includes(selectedCluster) ? 'complaint' : 'praise';
  }, [selectedCluster, rawClusters]);

  // Reset review index when keyword changes
  useEffect(() => {
    setCurrentReviewIndex(0);
  }, [selectedKeyword]);

  // Get reviews from cluster with proper fallback handling
  const reviews = useMemo(() => {
    if (!selectedCluster) return [];
    if (selectedCluster.all_reviews?.length) return selectedCluster.all_reviews;
    if (selectedCluster.sample_review) return [selectedCluster.sample_review];
    return [];
  }, [selectedCluster]);

  const currentReview = reviews[currentReviewIndex] || '';
  const totalReviews = reviews.length;

  const handlePrevious = () => {
    setCurrentReviewIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentReviewIndex((prev) => Math.min(totalReviews - 1, prev + 1));
  };

  const handleClose = () => {
    setKeyword(null);
  };

  // Extract ALL keyword variations from the cluster for highlighting
  const allKeywordVariations = useMemo(() => {
    if (!selectedCluster) return [];
    // cluster.keywords is an array of [keyword, count] tuples
    return selectedCluster.keywords.map(([keyword]) => keyword);
  }, [selectedCluster]);

  // Highlight ALL keyword variations in review text (case-insensitive, yellow background)
  const highlightedReview = useMemo(() => {
    if (!allKeywordVariations.length || !currentReview) return currentReview;

    const parts: React.ReactNode[] = [];
    // Sort variations by length (longest first) to match phrases before individual words
    const sortedVariations = [...allKeywordVariations].sort((a, b) => b.length - a.length);

    // Escape all keyword variations and join with OR for regex
    const escapedKeywords = sortedVariations.map(kw =>
      kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');
    const segments = currentReview.split(regex);

    segments.forEach((segment, index) => {
      // Check if segment matches any keyword variation (case-insensitive)
      const isKeyword = allKeywordVariations.some(
        kw => segment.toLowerCase() === kw.toLowerCase()
      );

      if (segment && isKeyword) {
        parts.push(
          <mark key={index} className="bg-yellow-400 text-black px-1 rounded">
            {segment}
          </mark>
        );
      } else if (segment) {
        parts.push(segment);
      }
    });

    return parts;
  }, [currentReview, allKeywordVariations]);

  // Show drawer only when keyword is selected and has reviews
  const shouldShow = !!(selectedKeyword && selectedCluster && totalReviews > 0);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
          className="fixed inset-x-0 bottom-0 h-[400px] glass z-50 flex flex-col border-t border-white/10"
        >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-base text-white">
              {selectedKeyword}
            </h3>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Average metrics for this keyword cluster */}
          <div className="flex items-center gap-4 text-xs">
            <p className="text-slate-400">
              Review {currentReviewIndex + 1} of {totalReviews}
            </p>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-2 text-slate-400">
              <span>Avg for this keyword:</span>
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                <span className="font-medium text-yellow-500">
                  {selectedCluster.avg_stars.toFixed(1)}
                </span>
              </div>
              <span className="text-slate-600">•</span>
              <div className="flex items-center gap-1">
                <span>Sentiment:</span>
                <span className={`font-medium ${sentiment === 'complaint' ? 'text-red-400' : 'text-green-400'}`}>
                  {selectedCluster.avg_sentiment > 0 ? '+' : ''}{selectedCluster.avg_sentiment.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Review Content with Navigation Arrows on Sides */}
        <div className="flex-1 overflow-hidden px-6 py-4 flex items-start gap-4">
          {/* Left Arrow */}
          <button
            onClick={handlePrevious}
            disabled={currentReviewIndex === 0}
            className="flex-shrink-0 p-3 hover:bg-white/10 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent sticky top-0"
            aria-label="Previous review"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Review Text */}
          <div className="flex-1 overflow-y-auto py-2 max-h-full">
            <div className="text-sm leading-relaxed text-slate-200">
              {highlightedReview}
            </div>
          </div>

          {/* Right Arrow */}
          <button
            onClick={handleNext}
            disabled={currentReviewIndex === totalReviews - 1}
            className="flex-shrink-0 p-3 hover:bg-white/10 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent sticky top-0"
            aria-label="Next review"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Memoized export to prevent unnecessary re-renders
export const KeywordReviewDrawer = memo(KeywordReviewDrawerComponent);
