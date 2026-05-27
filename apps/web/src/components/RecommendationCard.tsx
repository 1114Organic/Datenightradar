import { Archive, CheckCircle2, Heart } from "lucide-react";
import type { Recommendation } from "../api/client";

interface Props {
  recommendation: Recommendation;
  onWantToTry: (restaurantId: string) => void;
  onVisited: (restaurantId: string) => void;
  onArchive: (restaurantId: string) => void;
}

export function RecommendationCard({ recommendation, onWantToTry, onVisited, onArchive }: Props) {
  return (
    <article className="recommendation-card">
      <div className="card-top">
        <span className="badge">{recommendation.category}</span>
        <strong>{recommendation.score}</strong>
      </div>
      <h3>{recommendation.name}</h3>
      <p className="meta">{recommendation.cuisine} · {recommendation.area} · {recommendation.priceLevel}</p>
      <div className="chips compact">
        {recommendation.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
      </div>
      <ul>
        {recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      <div className="actions">
        <button title="Save to Want to Try" onClick={() => onWantToTry(recommendation.restaurantId)}><Heart size={18} /></button>
        <button title="Mark Visited" onClick={() => onVisited(recommendation.restaurantId)}><CheckCircle2 size={18} /></button>
        <button title="Not interested" onClick={() => onArchive(recommendation.restaurantId)}><Archive size={18} /></button>
      </div>
    </article>
  );
}
