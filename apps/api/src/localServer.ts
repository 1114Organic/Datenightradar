import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler } from "./handlers/api.js";

const port = Number(process.env.PORT ?? 3001);
process.env.DEV_AUTH_BYPASS ??= "true";
process.env.DEFAULT_USER_ID ??= "dev-user";
process.env.APP_ENV ??= "dev";

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const event = {
    rawPath: url.pathname,
    rawQueryString: url.searchParams.toString(),
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    body: Buffer.concat(chunks).toString() || undefined,
    requestContext: {
      requestId: randomUUID(),
      http: { method: req.method ?? "GET", path: url.pathname, protocol: "HTTP/1.1", sourceIp: "127.0.0.1", userAgent: req.headers["user-agent"] ?? "" }
    }
  } as APIGatewayProxyEventV2;

  const response = await handler(event);
  if (!response) {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }
  res.writeHead(response.statusCode ?? 200, { ...corsHeaders(), ...(response.headers as Record<string, string>) });
  res.end(response.body);
});

server.listen(port, () => {
  console.log(`Date Night Radar API running at http://localhost:${port}/api`);
});

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-allow-methods": "GET,PUT,POST,DELETE,OPTIONS"
  };
}
