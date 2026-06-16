import { Archive, CheckCircle2, ExternalLink, Heart, MapPin, Utensils } from "lucide-react";
import type { Recommendation } from "../api/client";

interface Props {
  recommendation: Recommendation;
  onWantToTry: (restaurantId: string) => void;
  onVisited: (restaurantId: string) => void;
  onArchive: (restaurantId: string) => void;
}

export function RecommendationCard({ recommendation, onWantToTry, onVisited, onArchive }: Props) {
  const locationQuery = [recommendation.name, recommendation.area].filter(Boolean).join(" ");
  const links = {
    website: `https://www.google.com/search?q=${encodeURIComponent(`${locationQuery} official website`)}`,
    maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`,
    menu: `https://www.google.com/search?q=${encodeURIComponent(`${locationQuery} menu`)}`
  };

  return (
    <article className="recommendation-card">
      <div className="card-top">
        <span className="badge">{recommendation.category}</span>
        <strong>{recommendation.score}</strong>
      </div>
      <h3>{recommendation.name}</h3>
      <p className="meta">{recommendation.cuisine} · {recommendation.area} · {recommendation.priceLevel}</p>
      <div className="resource-links" aria-label={`${recommendation.name} links`}>
        <a href={links.website} target="_blank" rel="noreferrer" title={`Find ${recommendation.name}'s website`} aria-label={`Find ${recommendation.name}'s website`}>
          <ExternalLink size={16} />
          Website
        </a>
        <a href={links.maps} target="_blank" rel="noreferrer" title={`Open ${recommendation.name} in Google Maps`} aria-label={`Open ${recommendation.name} in Google Maps`}>
          <MapPin size={16} />
          Maps
        </a>
        <a href={links.menu} target="_blank" rel="noreferrer" title={`Find ${recommendation.name}'s menu`} aria-label={`Find ${recommendation.name}'s menu`}>
          <Utensils size={16} />
          Menu
        </a>
      </div>
      <div className="chips compact">
        {recommendation.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
      </div>
      <ul>
        {recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      <div className="actions">
        <button title="Save to Want to Try" aria-label={`Save ${recommendation.name} to Want to Try`} onClick={() => onWantToTry(recommendation.restaurantId)}><Heart size={18} /></button>
        <button title="Mark Visited" aria-label={`Mark ${recommendation.name} as visited`} onClick={() => onVisited(recommendation.restaurantId)}><CheckCircle2 size={18} /></button>
        <button title="Not interested" aria-label={`Mark ${recommendation.name} as not interested`} onClick={() => onArchive(recommendation.restaurantId)}><Archive size={18} /></button>
      </div>
    </article>
  );
}
