const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

export interface RecommendationRequest {
  area: string;
  occasion: string;
  priceLevels: string[];
  newOnly: boolean;
  includeWantToTry: boolean;
}

export interface Restaurant {
  restaurantId: string;
  name: string;
  area: string;
  city?: string;
  state?: string;
  zipCode?: string;
  address?: string;
  cuisineCategories: string[];
  priceLevel: string;
  publicRating?: number;
  reviewCount?: number;
  tags: string[];
}

export interface Recommendation {
  category: string;
  restaurantId: string;
  name: string;
  score: number;
  cuisine: string;
  area: string;
  city?: string;
  state?: string;
  priceLevel: string;
  tags: string[];
  reasons: string[];
}

export interface UserProfile {
  name: string;
  homeArea: string;
  favoriteCuisines: string[];
  dislikedCuisines: string[];
  preferredPriceLevels: string[];
  preferredTags: string[];
  dealBreakers: string[];
}

export const api = {
  getProfile: () => request<UserProfile>("/users/me"),
  putProfile: (profile: Partial<UserProfile>) => request<UserProfile>("/users/me", { method: "PUT", body: profile }),
  listRestaurants: () => request<Restaurant[]>("/restaurants"),
  createRestaurant: (restaurant: Partial<Restaurant>) => request<Restaurant>("/restaurants", { method: "POST", body: restaurant }),
  saveWantToTry: (restaurantId: string) => request(`/users/me/restaurants/${restaurantId}/want-to-try`, { method: "POST" }),
  archive: (restaurantId: string) => request(`/users/me/restaurants/${restaurantId}/archive`, { method: "POST" }),
  createVisit: (visit: unknown) => request("/visits", { method: "POST", body: visit }),
  recommendations: (input: RecommendationRequest) => request<{ recommendations: Recommendation[] }>("/recommendations", { method: "POST", body: input })
};

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers = options.body ? { "content-type": "application/json" } : undefined;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
