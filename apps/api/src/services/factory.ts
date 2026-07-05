import { AppService } from "./AppService.js";
import { GooglePlacesSearchProvider } from "../externalSearch/GooglePlacesSearchProvider.js";
import { ManualSearchProvider } from "../externalSearch/ManualSearchProvider.js";
import { DynamoRestaurantRepository } from "../repositories/DynamoRestaurantRepository.js";
import { InMemoryRestaurantRepository } from "../repositories/InMemoryRestaurantRepository.js";
import type { RestaurantSearchProvider } from "../externalSearch/RestaurantSearchProvider.js";

const localRepository = new InMemoryRestaurantRepository();

export function createAppService() {
  const useMemory = process.env.APP_ENV !== "prod" || !process.env.TABLE_NAME;
  const repository = useMemory ? localRepository : new DynamoRestaurantRepository(process.env.TABLE_NAME!);
  return new AppService(repository, createSearchProvider());
}

function createSearchProvider(): RestaurantSearchProvider {
  if (process.env.EXTERNAL_SEARCH_PROVIDER === "google") {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY is required when EXTERNAL_SEARCH_PROVIDER=google");
    return new GooglePlacesSearchProvider(apiKey, Number(process.env.GOOGLE_PLACES_PAGE_SIZE ?? 10));
  }
  return new ManualSearchProvider();
}
