import { AppService } from "./AppService.js";
import { ManualSearchProvider } from "../externalSearch/ManualSearchProvider.js";
import { DynamoRestaurantRepository } from "../repositories/DynamoRestaurantRepository.js";
import { InMemoryRestaurantRepository } from "../repositories/InMemoryRestaurantRepository.js";

const localRepository = new InMemoryRestaurantRepository();

export function createAppService() {
  const useMemory = process.env.APP_ENV !== "prod" || !process.env.TABLE_NAME;
  const repository = useMemory ? localRepository : new DynamoRestaurantRepository(process.env.TABLE_NAME!);
  return new AppService(repository, new ManualSearchProvider());
}
