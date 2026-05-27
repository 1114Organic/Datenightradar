export type PriceLevel = "$" | "$$" | "$$$" | "$$$$";
export type VisitRating = "loved" | "liked" | "fine" | "no";
export type RestaurantStatus = "want_to_try" | "visited" | "archived";

export interface UserProfile {
  entityType: "UserProfile";
  userId: string;
  name: string;
  homeArea: string;
  favoriteCuisines: string[];
  dislikedCuisines: string[];
  preferredPriceLevels: PriceLevel[];
  preferredTags: string[];
  dealBreakers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Household {
  entityType: "Household";
  householdId: string;
  name: string;
  memberUserIds: string[];
  sharedPreferences: {
    favoriteCuisines: string[];
    preferredTags: string[];
    preferredAreas: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface Restaurant {
  entityType: "Restaurant";
  restaurantId: string;
  name: string;
  address?: string;
  area: string;
  latitude?: number;
  longitude?: number;
  cuisineCategories: string[];
  priceLevel: PriceLevel;
  publicRating?: number;
  reviewCount?: number;
  externalIds?: Record<string, string>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserRestaurantState {
  entityType: "UserRestaurantState";
  userId: string;
  restaurantId: string;
  status: RestaurantStatus;
  personalTags: string[];
  lastVisitDate?: string;
  bestRating?: VisitRating;
  wouldReturn?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Visit {
  entityType: "Visit";
  visitId: string;
  userId: string;
  restaurantId: string;
  householdId?: string;
  visitDate: string;
  occasion: string;
  rating: VisitRating;
  wouldReturn: boolean;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationRequest {
  area?: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusMiles?: number;
  occasion?: string;
  cuisines?: string[];
  priceLevels?: PriceLevel[];
  newOnly?: boolean;
  includeWantToTry?: boolean;
  excludeRecentlyVisitedDays?: number;
}

export interface Recommendation {
  category: "Safe Bet" | "New Adventure" | "Wildcard";
  restaurantId: string;
  name: string;
  score: number;
  cuisine: string;
  area: string;
  priceLevel: PriceLevel;
  tags: string[];
  reasons: string[];
}
