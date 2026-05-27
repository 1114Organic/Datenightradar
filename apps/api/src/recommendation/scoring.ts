import type { Recommendation, RecommendationRequest, Restaurant, UserProfile, UserRestaurantState, Visit } from "../models/types.js";

interface ScoredRestaurant {
  restaurant: Restaurant;
  score: number;
  reasons: string[];
  similarity: number;
  visited: boolean;
}

export function recommendRestaurants(
  candidates: Restaurant[],
  profile: UserProfile,
  visits: Visit[],
  states: UserRestaurantState[],
  request: RecommendationRequest
): Recommendation[] {
  const stateByRestaurant = new Map(states.map((state) => [state.restaurantId, state]));
  const scored = candidates
    .filter((candidate) => !profile.dislikedCuisines.some((c) => candidate.cuisineCategories.includes(c)))
    .filter((candidate) => request.priceLevels?.length ? request.priceLevels.includes(candidate.priceLevel) : true)
    .filter((candidate) => !request.newOnly || !hasVisited(candidate, visits))
    .filter((candidate) => request.includeWantToTry || stateByRestaurant.get(candidate.restaurantId)?.status !== "want_to_try")
    .map((candidate) => scoreRestaurant(candidate, profile, visits, request))
    .sort((a, b) => b.score - a.score);

  return assignCategories(scored);
}

function scoreRestaurant(candidate: Restaurant, profile: UserProfile, visits: Visit[], request: RecommendationRequest): ScoredRestaurant {
  let score = 0;
  const reasons: string[] = [];

  if (matchesCuisine(candidate, profile, request)) {
    score += 25;
    reasons.push("Matches cuisines you usually like");
  }

  const similarity = calculateSimilarityToLovedRestaurants(candidate, visits);
  score += Math.round(similarity * 25);
  if (similarity > 0.7) reasons.push("Similar to restaurants you rated Loved It");

  if (matchesArea(candidate, profile, request)) {
    score += 15;
    reasons.push("Located in an area you visit");
  }

  if (matchesPrice(candidate, profile, request)) {
    score += 10;
    reasons.push("Fits your preferred price range");
  }

  if (request.occasion && candidate.tags.includes(request.occasion)) {
    score += 10;
    reasons.push(`Fits your ${request.occasion} preference`);
  } else if (candidate.tags.some((tag) => profile.preferredTags.includes(tag))) {
    score += 10;
    reasons.push("Matches dining styles you prefer");
  }

  if ((candidate.publicRating ?? 0) >= 4.2 && (candidate.reviewCount ?? 0) >= 50) {
    score += 10;
    reasons.push("Has a strong public rating signal");
  }

  const visited = hasVisited(candidate, visits);
  if (!visited) {
    score += 5;
    reasons.push("You have not visited this restaurant yet");
  }

  return { restaurant: candidate, score: Math.min(score, 100), reasons, similarity, visited };
}

function assignCategories(scored: ScoredRestaurant[]): Recommendation[] {
  const used = new Set<string>();
  const safeBet = scored.find((item) => item.similarity > 0.4) ?? scored[0];
  if (safeBet) used.add(safeBet.restaurant.restaurantId);

  const newAdventure = scored.find((item) => !used.has(item.restaurant.restaurantId) && !item.visited) ?? scored.find((item) => !used.has(item.restaurant.restaurantId));
  if (newAdventure) used.add(newAdventure.restaurant.restaurantId);

  const wildcard = scored.find((item) => !used.has(item.restaurant.restaurantId) && item.score >= 40) ?? scored.find((item) => !used.has(item.restaurant.restaurantId));

  return [
    safeBet && toRecommendation("Safe Bet", safeBet),
    newAdventure && toRecommendation("New Adventure", newAdventure),
    wildcard && toRecommendation("Wildcard", wildcard)
  ].filter(Boolean) as Recommendation[];
}

function toRecommendation(category: Recommendation["category"], item: ScoredRestaurant): Recommendation {
  return {
    category,
    restaurantId: item.restaurant.restaurantId,
    name: item.restaurant.name,
    score: item.score,
    cuisine: item.restaurant.cuisineCategories.join(", ") || "Unknown",
    area: item.restaurant.area,
    priceLevel: item.restaurant.priceLevel,
    tags: item.restaurant.tags,
    reasons: item.reasons
  };
}

function matchesCuisine(candidate: Restaurant, profile: UserProfile, request: RecommendationRequest) {
  const desired = request.cuisines?.length ? request.cuisines : profile.favoriteCuisines;
  return desired.some((cuisine) => candidate.cuisineCategories.some((candidateCuisine) => candidateCuisine.toLowerCase() === cuisine.toLowerCase()));
}

function matchesArea(candidate: Restaurant, profile: UserProfile, request: RecommendationRequest) {
  return Boolean(request.area && candidate.area.toLowerCase().includes(request.area.toLowerCase())) || candidate.area.toLowerCase() === profile.homeArea.toLowerCase();
}

function matchesPrice(candidate: Restaurant, profile: UserProfile, request: RecommendationRequest) {
  const desired = request.priceLevels?.length ? request.priceLevels : profile.preferredPriceLevels;
  return desired.includes(candidate.priceLevel);
}

function calculateSimilarityToLovedRestaurants(candidate: Restaurant, visits: Visit[]) {
  const loved = visits.filter((visit) => visit.rating === "loved" || visit.rating === "liked");
  if (!loved.length) return 0;
  const matchingCuisineVisits = loved.filter((visit) => candidate.tags.some((tag) => visit.tags.includes(tag))).length;
  return Math.min(1, matchingCuisineVisits / loved.length + (candidate.publicRating ?? 0) / 10);
}

function hasVisited(candidate: Restaurant, visits: Visit[]) {
  return visits.some((visit) => visit.restaurantId === candidate.restaurantId);
}
