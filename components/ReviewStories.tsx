import type { Review } from '@/lib/types';

type ReviewStoriesProps = {
  reviews: Review[];
};

export default function ReviewStories({ reviews }: ReviewStoriesProps) {
  if (!reviews.length) return null;

  return (
    <div className="review-stories">
      <div className="review-stories__grid">
        {reviews.map((review, index) => (
          <article className="review-stories__card" data-review-slide key={`${review.name}-${index}`}>
            <blockquote>
              <p>{review.text}</p>
              <footer><cite>{review.name}</cite></footer>
            </blockquote>
          </article>
        ))}
      </div>
    </div>
  );
}
