import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { createAppService } from "../services/factory.js";

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    const userId = currentUserId(event);
    const service = createAppService();
    const method = event.requestContext.http.method;
    const path = event.rawPath.replace(/^\/api/, "") || "/";
    const body = event.body ? JSON.parse(event.body) : {};
    const query = event.queryStringParameters ?? {};

    if (method === "GET" && path === "/users/me") return json(await service.getProfile(userId));
    if (method === "PUT" && path === "/users/me") return json(await service.putProfile(userId, body));

    if (method === "POST" && path === "/restaurants") return json(await service.createRestaurant(body), 201);
    if (method === "GET" && path === "/restaurants") return json(await service.listRestaurants(query));
    if (method === "GET" && path.startsWith("/restaurants/")) return json(await service.getRestaurant(path.split("/")[2]));
    if (method === "PUT" && path.startsWith("/restaurants/")) return json(await service.updateRestaurant(path.split("/")[2], body));

    if (method === "GET" && path === "/search/restaurants") return json(await service.searchRestaurants(query));

    const wantToTry = path.match(/^\/users\/me\/restaurants\/([^/]+)\/want-to-try$/);
    if (method === "POST" && wantToTry) return json(await service.markRestaurant(userId, wantToTry[1], "want_to_try"));

    const archive = path.match(/^\/users\/me\/restaurants\/([^/]+)\/archive$/);
    if (method === "POST" && archive) return json(await service.markRestaurant(userId, archive[1], "archived"));

    if (method === "GET" && path === "/users/me/restaurants") return json(await service.listUserRestaurants(userId, query.status));

    if (method === "POST" && path === "/visits") return json(await service.createVisit(userId, body), 201);
    if (method === "GET" && path === "/visits") return json(await service.listVisits(userId, query));

    if (method === "POST" && path === "/recommendations") return json(await service.getRecommendations(userId, body));

    return json({ message: "Not found" }, 404);
  } catch (error) {
    console.error("api_error", { message: error instanceof Error ? error.message : String(error), requestId: event.requestContext.requestId });
    return json({ message: error instanceof Error ? error.message : "Unexpected error" }, 400);
  }
}

function currentUserId(event: APIGatewayProxyEventV2): string {
  if (process.env.DEV_AUTH_BYPASS === "true") return process.env.DEFAULT_USER_ID ?? "dev-user";
  const requestContext = event.requestContext as typeof event.requestContext & { authorizer?: { jwt?: { claims?: { sub?: string } } } };
  const authorizer = requestContext.authorizer;
  return authorizer?.jwt?.claims?.sub ?? "unknown-user";
}

function json(data: unknown, statusCode = 200): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,authorization",
      "access-control-allow-methods": "GET,PUT,POST,OPTIONS"
    },
    body: JSON.stringify(data)
  };
}
