let apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
let authToken: string | undefined;

export function configureApi(input: { apiBaseUrl?: string; authToken?: string }) {
  apiBaseUrl = input.apiBaseUrl ?? apiBaseUrl;
  authToken = input.authToken;
}

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
  city: string;
  state: string;
  zipCode: string;
  address?: string;
  cuisineCategories: string[];
  priceLevel: string;
  publicRating?: number;
  reviewCount?: number;
  tags: string[];
}

export interface RestaurantImportTarget {
  type: string;
  value: string;
}

export interface RestaurantImportResult {
  importedCount: number;
  skippedCount: number;
  targets: RestaurantImportTarget[];
  restaurants: Restaurant[];
}

export interface UserRestaurantState {
  userId: string;
  restaurantId: string;
  status: "want_to_try" | "visited" | "archived";
  personalTags: string[];
  lastVisitDate?: string;
  bestRating?: string;
  wouldReturn?: boolean;
}

export interface Visit {
  visitId: string;
  userId: string;
  restaurantId: string;
  visitDate: string;
  occasion: string;
  rating: string;
  wouldReturn: boolean;
  tags: string[];
  notes?: string;
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
  firstName?: string;
  lastName?: string;
  email?: string;
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
  updateRestaurant: (restaurantId: string, restaurant: Partial<Restaurant>) => request<Restaurant>(`/restaurants/${restaurantId}`, { method: "PUT", body: restaurant }),
  deleteRestaurant: (restaurantId: string) => request<{ restaurantId: string }>(`/restaurants/${restaurantId}`, { method: "DELETE" }),
  importRestaurants: (targets: RestaurantImportTarget[]) => request<RestaurantImportResult>("/admin/import/restaurants", { method: "POST", body: { targets } }),
  saveWantToTry: (restaurantId: string) => request(`/users/me/restaurants/${restaurantId}/want-to-try`, { method: "POST" }),
  archive: (restaurantId: string) => request(`/users/me/restaurants/${restaurantId}/archive`, { method: "POST" }),
  listUserRestaurants: (status?: string) => request<UserRestaurantState[]>(`/users/me/restaurants${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  createVisit: (visit: unknown) => request("/visits", { method: "POST", body: visit }),
  listVisits: () => request<Visit[]>("/visits"),
  recommendations: (input: RecommendationRequest) => request<{ recommendations: Recommendation[] }>("/recommendations", { method: "POST", body: input })
};

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body) headers["content-type"] = "application/json";
  if (authToken) headers.authorization = `Bearer ${authToken}`;
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: Object.keys(headers).length ? headers : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
