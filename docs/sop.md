# Date Night Radar SOP

This SOP describes the default operating flow for changing, testing, deploying, and verifying Date Night Radar.

## Default Change Flow

1. Read the relevant code before editing.
2. Keep changes scoped to the user request.
3. Run the smallest useful local verification.
4. For frontend or deployed behavior changes, verify the app in a browser with Playwright MCP.
5. Commit changes on a `codex/` branch.
6. Open a pull request.
7. Wait for required GitHub checks to pass.
8. Merge only after checks pass.

## Playwright MCP Browser Verification

Use Playwright MCP as part of the normal workflow, not as an optional extra, whenever a change affects:

- React UI behavior
- Forms, buttons, filters, toggles, or navigation
- API calls triggered from the browser
- CloudFront, API Gateway, Lambda, or CORS behavior
- Deployed app smoke testing
- Bugs reported with screenshots or browser symptoms

### Local Smoke Test

When testing locally:

1. Start the API and web app.
2. Use Playwright MCP to open the local web URL.
3. Check the browser console for errors.
4. Exercise the changed workflow.
5. Confirm the visible UI result.

Suggested local checks:

- Home page loads.
- Add Restaurant saves a restaurant and shows feedback.
- Saved Restaurants updates.
- Pick 3 for us returns a visible result when matching restaurants exist.
- Visit Rating can mark a restaurant as visited.

### Deployed Smoke Test

After an AWS deploy, use Playwright MCP against the CloudFront URL:

```text
https://d10jizsl6nso4r.cloudfront.net
```

Required deployed checks:

- Page loads without a visible error banner.
- Browser console has no new application errors.
- Add Restaurant works for a test restaurant.
- Saved Restaurants updates after adding.
- Pick 3 for us returns recommendations when matching data exists.
- API-backed actions do not fail with CORS or network errors.

## Deployment Flow

Build with the deployed API URL before deploying the frontend:

```bash
VITE_API_BASE_URL=https://dbywt1ij15.execute-api.us-east-1.amazonaws.com/api npm run build
npm run cdk -- deploy -c authMode=dev -c budgetEmail=theochsclaw@gmail.com -c monthlyBudgetLimit=10 --require-approval never
```

Keep `authMode=dev` private. Do not share the deployed URL publicly until Cognito sign-in is wired into the frontend.

## Cost Guardrails

Deploys should keep budget alerts enabled:

```bash
-c budgetEmail=theochsclaw@gmail.com -c monthlyBudgetLimit=10
```

AWS Budgets are alerts, not a hard spending cap. If tighter controls are needed, add Budget Actions, service quotas, or account-level guardrails.

## Bug Triage Flow

When the user reports a browser issue:

1. Reproduce with Playwright MCP when available.
2. Check browser console errors.
3. Check browser network failures.
4. Test the matching API route directly with `curl` if needed.
5. Read CloudWatch logs for deployed Lambda failures.
6. Fix the root cause.
7. Redeploy if the issue affects AWS.
8. Re-run the Playwright MCP browser check.

## GitHub Flow

Use protected-branch flow:

1. Create a branch named `codex/<short-description>`.
2. Commit focused changes.
3. Push the branch.
4. Open a pull request.
5. Wait for required checks.
6. Merge after checks pass.
7. Sync local `main`.

