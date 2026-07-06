import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CfnBudget } from "aws-cdk-lib/aws-budgets";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Rule, RuleTargetInput, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { CorsHttpMethod, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { AccountRecovery, CfnUserPoolGroup, OAuthScope, UserPool, UserPoolClientIdentityProvider } from "aws-cdk-lib/aws-cognito";
import { Bucket, BlockPublicAccess } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { Distribution, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";

export class RestaurantRadarStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const authMode = this.node.tryGetContext("authMode") === "dev" ? "dev" : "cognito";
    const budgetEmail = this.node.tryGetContext("budgetEmail") as string | undefined;
    const externalSearchProvider = this.node.tryGetContext("externalSearchProvider") === "google" ? "google" : "manual";
    const googlePlacesApiKeySecretName = this.node.tryGetContext("googlePlacesApiKeySecretName") as string | undefined;
    const googlePlacesPageSize = Number(this.node.tryGetContext("googlePlacesPageSize") ?? 10);
    const requestedBudgetLimit = Number(this.node.tryGetContext("monthlyBudgetLimit") ?? 10);
    const monthlyBudgetLimit = Number.isFinite(requestedBudgetLimit) && requestedBudgetLimit > 0
      ? requestedBudgetLimit
      : 10;
    const budgetAlertThresholds = Array.from(new Set([1, 5, monthlyBudgetLimit])).sort((a, b) => a - b);
    if (externalSearchProvider === "google" && !googlePlacesApiKeySecretName) {
      throw new Error("Pass -c googlePlacesApiKeySecretName=<secret-name> when -c externalSearchProvider=google.");
    }

    const table = new Table(this, "RestaurantRadarTable", {
      tableName: "RestaurantRadarTable",
      partitionKey: { name: "PK", type: AttributeType.STRING },
      sortKey: { name: "SK", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN
    });

    const userPool = new UserPool(this, "UserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      accountRecovery: AccountRecovery.EMAIL_ONLY
    });

    const webBucket = new Bucket(this, "WebBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false
    });

    const distribution = new Distribution(this, "WebDistribution", {
      defaultBehavior: {
        origin: new S3Origin(webBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      defaultRootObject: "index.html"
    });

    const cloudFrontUrl = `https://${distribution.distributionDomainName}`;
    const localhostUrls = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"];
    const userPoolDomainPrefix = this.node.tryGetContext("cognitoDomainPrefix") as string | undefined
      ?? `date-night-radar-${this.account}`;
    const userPoolDomain = userPool.addDomain("UserPoolDomain", {
      cognitoDomain: { domainPrefix: userPoolDomainPrefix }
    });
    const cognitoDomainUrl = `https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`;

    const userPoolClient = userPool.addClient("WebClient", {
      supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE],
        callbackUrls: [cloudFrontUrl, ...localhostUrls],
        logoutUrls: [cloudFrontUrl, ...localhostUrls]
      }
    });

    new CfnUserPoolGroup(this, "AdminGroup", {
      userPoolId: userPool.userPoolId,
      groupName: "Admin",
      description: "Users who can access Date Night Radar admin tools."
    });

    const apiLogGroup = new LogGroup(this, "ApiFunctionLogGroup", {
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.RETAIN
    });
    const googlePlacesApiKeySecret = googlePlacesApiKeySecretName
      ? Secret.fromSecretNameV2(this, "GooglePlacesApiKeySecret", googlePlacesApiKeySecretName)
      : undefined;

    const apiFunction = new NodejsFunction(this, "ApiFunction", {
      entry: "../apps/api/src/handlers/api.ts",
      handler: "handler",
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(10),
      memorySize: 256,
      logGroup: apiLogGroup,
      bundling: {
        format: OutputFormat.CJS,
        target: "node20",
        externalModules: []
      },
      environment: {
        APP_ENV: "prod",
        TABLE_NAME: table.tableName,
        DEV_AUTH_BYPASS: authMode === "dev" ? "true" : "false",
        DEFAULT_USER_ID: "dev-user",
        EXTERNAL_SEARCH_PROVIDER: externalSearchProvider,
        GOOGLE_PLACES_API_KEY_SECRET_NAME: googlePlacesApiKeySecretName ?? "",
        GOOGLE_PLACES_PAGE_SIZE: Number.isFinite(googlePlacesPageSize) ? String(googlePlacesPageSize) : "10",
        LOG_LEVEL: "info"
      }
    });

    table.grantReadWriteData(apiFunction);
    googlePlacesApiKeySecret?.grantRead(apiFunction);

    new Rule(this, "WeeklyRestaurantImportRule", {
      schedule: Schedule.cron({ minute: "0", hour: "9", weekDay: "SUN" }),
      targets: [new LambdaFunction(apiFunction, {
        event: RuleTargetInput.fromObject({
          source: "restaurant-radar.scheduler",
          detailType: "WeeklyRestaurantImport",
          detail: {}
        })
      })]
    });

    const httpApi = new HttpApi(this, "HttpApi", {
      corsPreflight: {
        allowHeaders: ["content-type", "authorization"],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.PUT, CorsHttpMethod.POST, CorsHttpMethod.DELETE, CorsHttpMethod.OPTIONS],
        allowOrigins: ["*"]
      }
    });
    const routeOptions = {
      path: "/api/{proxy+}",
      methods: [HttpMethod.ANY],
      integration: new HttpLambdaIntegration("ApiIntegration", apiFunction)
    };
    httpApi.addRoutes(authMode === "cognito" ? {
      ...routeOptions,
      authorizer: new HttpUserPoolAuthorizer("ApiAuthorizer", userPool, {
        userPoolClients: [userPoolClient]
      })
    } : routeOptions);

    new BucketDeployment(this, "WebDeployment", {
      sources: [
        Source.asset("../apps/web/dist"),
        Source.jsonData("runtime-config.json", {
          apiBaseUrl: `${httpApi.apiEndpoint}/api`,
          authMode,
          cognitoDomain: cognitoDomainUrl,
          userPoolClientId: userPoolClient.userPoolClientId,
          userPoolId: userPool.userPoolId
        })
      ],
      destinationBucket: webBucket,
      distribution,
      distributionPaths: ["/*"]
    });

    if (budgetEmail) {
      new CfnBudget(this, "MonthlyCostBudget", {
        budget: {
          budgetName: "DateNightRadar-Monthly-Cost",
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: {
            amount: monthlyBudgetLimit,
            unit: "USD"
          }
        },
        notificationsWithSubscribers: [
          ...budgetAlertThresholds.map((threshold) => ({
            notification: {
              comparisonOperator: "GREATER_THAN",
              notificationType: "ACTUAL",
              threshold,
              thresholdType: "ABSOLUTE_VALUE"
            },
            subscribers: [{
              address: budgetEmail,
              subscriptionType: "EMAIL"
            }]
          })),
          {
            notification: {
              comparisonOperator: "GREATER_THAN",
              notificationType: "FORECASTED",
              threshold: monthlyBudgetLimit,
              thresholdType: "ABSOLUTE_VALUE"
            },
            subscribers: [{
              address: budgetEmail,
              subscriptionType: "EMAIL"
            }]
          }
        ]
      });
    }

    new CfnOutput(this, "AuthMode", { value: authMode });
    new CfnOutput(this, "BudgetAlerts", { value: budgetEmail ? `Enabled for ${budgetEmail}` : "Disabled. Pass -c budgetEmail=you@example.com to enable." });
    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, "CognitoDomain", { value: cognitoDomainUrl });
    new CfnOutput(this, "WebBucketName", { value: webBucket.bucketName });
    new CfnOutput(this, "CloudFrontDomainName", { value: distribution.distributionDomainName });
  }
}
