# Date Night Radar

Date Night Radar is a low-cost serverless MVP for remembering restaurants, tracking visits, and generating three explainable recommendations: Safe Bet, New Adventure, and Wildcard.

## Screenshots

![Date Night Radar home screen](docs/screenshots/home.jpg)

![Date Night Radar recommendation cards](docs/screenshots/recommendations.jpg)

## Stack

- React + Vite + TypeScript frontend in `apps/web`
- TypeScript Lambda API in `apps/api`
- DynamoDB single-table data model
- AWS CDK TypeScript infrastructure in `infra`
- Manual-only external restaurant search by default

## Local Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run dev:api
npm run dev
```

The web app expects the API at `http://localhost:3001/api` by default. Set `VITE_API_BASE_URL` to override it.

## API Environment

```text
APP_ENV=dev
TABLE_NAME=RestaurantRadarTable
DEV_AUTH_BYPASS=true
DEFAULT_USER_ID=dev-user
EXTERNAL_SEARCH_PROVIDER=manual
LOG_LEVEL=info
```

`DEV_AUTH_BYPASS=true` uses `DEFAULT_USER_ID` for local development. Production should validate Cognito JWTs at API Gateway/Lambda and set `DEV_AUTH_BYPASS=false`.

## Deploy

Prerequisites:

- An AWS account
- AWS CLI configured with credentials for that account
- CDK bootstrapped once per AWS account/region

```bash
npm install
npm run build
npm run cdk -- bootstrap
npm run cdk -- synth -c authMode=dev
npm run cdk -- deploy -c authMode=dev
```

The `authMode=dev` deployment is the fastest way to get a working hosted MVP. It uses `DEV_AUTH_BYPASS=true` with `DEFAULT_USER_ID=dev-user`, so do not treat it as production auth.

For the production direction, deploy with Cognito enabled:

```bash
npm run cdk -- deploy -c authMode=cognito
```

The `authMode=cognito` stack protects API routes with a Cognito authorizer. The current frontend still needs a sign-in flow before that mode is usable from the browser.

The CDK stack creates S3 + CloudFront, API Gateway HTTP API, Lambda, DynamoDB, Cognito, and least-privilege table access. It also uploads `apps/web/dist` to the hosting bucket and invalidates CloudFront.

## Cost Controls

- Lambda, DynamoDB on-demand, S3, CloudFront, and HTTP API avoid always-on compute.
- External search defaults to manual mode and is abstracted behind a provider interface.
- Cache imported restaurant records in DynamoDB before calling any future paid provider.
- Keep CloudWatch logs concise and avoid logging notes, secrets, tokens, or API keys.
- Configure AWS Budgets alerts at $1, $5, and $10.

## MVP Checklist

- Preferences can be created and edited.
- Restaurants can be added manually.
- Restaurants can be saved as Want to Try, archived, or marked visited.
- Visits store rating, return intent, occasion, tags, and notes.
- Recommendation engine returns three scored cards with deterministic explanations.
- Manual-only mode works without external API keys.
