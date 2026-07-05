import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { RecommendationRequest, Restaurant, UserProfile, UserRestaurantState, Visit } from "../models/types.js";
import type { RestaurantRepository } from "./RestaurantRepository.js";
import { normalizeKey } from "../utils/normalize.js";

export class DynamoRestaurantRepository implements RestaurantRepository {
  private doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  constructor(private tableName: string) {}

  async getUserProfile(userId: string) {
    const result = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { PK: `USER#${userId}`, SK: "PROFILE" } }));
    return result.Item as UserProfile | undefined;
  }

  async putUserProfile(profile: UserProfile) {
    await this.doc.send(new PutCommand({ TableName: this.tableName, Item: { ...profile, PK: `USER#${profile.userId}`, SK: "PROFILE" } }));
    return profile;
  }

  async listRestaurants(filters: { area?: string; cuisine?: string; priceLevel?: string; tag?: string } = {}) {
    let items: Restaurant[];
    if (filters.area) {
      const result = await this.doc.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": `AREA#${normalizeKey(filters.area)}`, ":sk": "RESTAURANT#" }
      }));
      items = (result.Items ?? []) as Restaurant[];
    } else {
      const result = await this.doc.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: "entityType = :type",
        ExpressionAttributeValues: { ":type": "Restaurant" }
      }));
      items = (result.Items ?? []) as Restaurant[];
    }
    return items.filter((restaurant) =>
      (!filters.cuisine || restaurant.cuisineCategories?.some((c) => c.toLowerCase() === filters.cuisine?.toLowerCase()))
      && (!filters.priceLevel || restaurant.priceLevel === filters.priceLevel)
      && (!filters.tag || restaurant.tags?.includes(filters.tag))
    );
  }

  async getRestaurant(restaurantId: string) {
    const result = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { PK: `RESTAURANT#${restaurantId}`, SK: "METADATA" } }));
    return result.Item as Restaurant | undefined;
  }

  async putRestaurant(restaurant: Restaurant) {
    await this.deleteRestaurantIndexes(restaurant.restaurantId);
    await this.doc.send(new PutCommand({ TableName: this.tableName, Item: { ...restaurant, PK: `RESTAURANT#${restaurant.restaurantId}`, SK: "METADATA" } }));
    await this.doc.send(new PutCommand({ TableName: this.tableName, Item: { ...restaurant, PK: `AREA#${normalizeKey(restaurant.area)}`, SK: `RESTAURANT#${restaurant.restaurantId}`, entityType: "AreaRestaurantIndex" } }));
    for (const cuisine of restaurant.cuisineCategories) {
      await this.doc.send(new PutCommand({ TableName: this.tableName, Item: { ...restaurant, PK: `CUISINE#${normalizeKey(cuisine)}`, SK: `RESTAURANT#${restaurant.restaurantId}`, entityType: "CuisineRestaurantIndex" } }));
    }
    return restaurant;
  }

  async deleteRestaurant(restaurantId: string) {
    await this.deleteRestaurantIndexes(restaurantId);
    await this.doc.send(new DeleteCommand({ TableName: this.tableName, Key: { PK: `RESTAURANT#${restaurantId}`, SK: "METADATA" } }));
  }

  private async deleteRestaurantIndexes(restaurantId: string) {
    const indexItems = await this.doc.send(new ScanCommand({
      TableName: this.tableName,
      FilterExpression: "restaurantId = :restaurantId AND entityType IN (:areaType, :cuisineType)",
      ExpressionAttributeValues: {
        ":restaurantId": restaurantId,
        ":areaType": "AreaRestaurantIndex",
        ":cuisineType": "CuisineRestaurantIndex"
      },
      ProjectionExpression: "PK, SK"
    }));
    await Promise.all((indexItems.Items ?? []).map((item) => this.doc.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { PK: item.PK, SK: item.SK }
    }))));
  }

  async getUserRestaurantState(userId: string, restaurantId: string) {
    const result = await this.doc.send(new GetCommand({ TableName: this.tableName, Key: { PK: `USER#${userId}`, SK: `RESTAURANT#${restaurantId}` } }));
    return result.Item as UserRestaurantState | undefined;
  }

  async putUserRestaurantState(state: UserRestaurantState) {
    await this.doc.send(new PutCommand({ TableName: this.tableName, Item: { ...state, PK: `USER#${state.userId}`, SK: `RESTAURANT#${state.restaurantId}` } }));
    return state;
  }

  async listUserRestaurantStates(userId: string, status?: string) {
    const result = await this.doc.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      FilterExpression: status ? "#status = :status" : undefined,
      ExpressionAttributeNames: status ? { "#status": "status" } : undefined,
      ExpressionAttributeValues: status ? { ":pk": `USER#${userId}`, ":sk": "RESTAURANT#", ":status": status } : { ":pk": `USER#${userId}`, ":sk": "RESTAURANT#" }
    }));
    return (result.Items ?? []) as UserRestaurantState[];
  }

  async putVisit(visit: Visit) {
    await this.doc.send(new PutCommand({ TableName: this.tableName, Item: { ...visit, PK: `USER#${visit.userId}`, SK: `VISIT#${visit.visitDate}#${visit.restaurantId}` } }));
    return visit;
  }

  async listVisits(userId: string, filters: { restaurantId?: string; rating?: string; occasion?: string } = {}) {
    const result = await this.doc.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":sk": "VISIT#" }
    }));
    return ((result.Items ?? []) as Visit[]).filter((visit) =>
      (!filters.restaurantId || visit.restaurantId === filters.restaurantId)
      && (!filters.rating || visit.rating === filters.rating)
      && (!filters.occasion || visit.occasion === filters.occasion)
    );
  }

  async listRecommendationCandidates(userId: string, request: RecommendationRequest) {
    return this.listRestaurants({ area: request.area });
  }
}
