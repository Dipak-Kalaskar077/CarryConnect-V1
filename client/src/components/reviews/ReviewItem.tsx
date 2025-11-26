import { Review, User } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star } from "lucide-react";

interface ReviewItemProps {
  review: Review & {
    reviewer: Partial<User>;
  };
}

const ReviewItem = ({ review }: ReviewItemProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i} 
            className={`h-4 w-4 ${
              i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
            }`} 
          />
        ))}
      </div>
    );
  };

  return (
    <li className="bg-gray-50 p-4 rounded-md">
      <div className="flex items-start">
        <Avatar className="h-10 w-10">
          <AvatarFallback>
            {review.reviewer.fullName?.charAt(0) || review.reviewer.username?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
        <div className="ml-3 flex-1">
          <div className="text-sm font-medium text-gray-900">
            {review.reviewer.fullName || review.reviewer.username}
          </div>
          <div className="mt-1">{renderStars(review.rating)}</div>
          
          {/* Multi-metric ratings */}
          {(review as any).punctuality && (review as any).communication && (review as any).packageHandling && (
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Punctuality:</span>
                <span className="font-medium">{renderStars((review as any).punctuality)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Communication:</span>
                <span className="font-medium">{renderStars((review as any).communication)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Package Handling:</span>
                <span className="font-medium">{renderStars((review as any).packageHandling)}</span>
              </div>
            </div>
          )}
          
          <div className="mt-2 text-sm text-gray-700">
            <p>{review.comment}</p>
          </div>
          <div className="mt-2 text-xs text-gray-500">
          {formatDate(
            review.createdAt instanceof Date
              ? review.createdAt.toISOString()
              : review.createdAt
          )}
          </div>
        </div>
      </div>
    </li>
  );
};

export default ReviewItem;
