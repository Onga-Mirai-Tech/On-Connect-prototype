#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { OnConnectStack } from "../lib/on-connect-stack";

const app = new cdk.App();

const envName = app.node.tryGetContext("envName") ?? "dev";

new OnConnectStack(app, `OnConnect-${envName}`, {
  envName,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
  },
  description: "On-Connect - 幼稚園・保育園・学校向けメンバー間コミュニケーションアプリ",
});
