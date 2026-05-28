# Security Notes

Do not commit real `.env` files, AWS credentials, API keys, or Cognito secrets.

The default CDK deployment mode is `authMode=cognito`, which enables a Cognito authorizer for API routes. The alternate `authMode=dev` mode is only for temporary private demos because it uses `DEV_AUTH_BYPASS=true` and a shared development user.

Before public deployment:

- Add a frontend Cognito sign-in flow.
- Keep `authMode=cognito`.
- Restrict API CORS origins to the deployed CloudFront domain.
- Store future external restaurant API keys in SSM Parameter Store or Secrets Manager.
- Review `npm audit` output and upgrade vulnerable dependencies where compatible.
