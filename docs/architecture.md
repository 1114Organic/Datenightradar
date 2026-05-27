# Architecture

```text
React + Vite
  -> API Gateway HTTP API
  -> Lambda TypeScript handlers
  -> DynamoDB single-table storage
```

The API code exposes repository interfaces so local development can use an in-memory store while production can use DynamoDB. Restaurant search is abstracted behind `RestaurantSearchProvider`; the MVP ships with a manual-only provider.
