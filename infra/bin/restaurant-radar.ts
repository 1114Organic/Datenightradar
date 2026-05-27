#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { RestaurantRadarStack } from "../lib/RestaurantRadarStack.js";

const app = new App();

new RestaurantRadarStack(app, "RestaurantRadarStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});
