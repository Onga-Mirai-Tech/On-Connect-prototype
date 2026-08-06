import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { OnConnectStack } from "../lib/on-connect-stack";

describe("OnConnectStack", () => {
  const app = new cdk.App();
  const stack = new OnConnectStack(app, "TestStack", {
    envName: "test",
    env: { account: "123456789012", region: "ap-northeast-1" },
  });
  const template = Template.fromStack(stack);

  test("Cognito User Pool が作成される", () => {
    template.resourceCountIs("AWS::Cognito::UserPool", 1);
  });

  test("主要テーブルが16個作成される", () => {
    template.resourceCountIs("AWS::DynamoDB::Table", 16);
  });

  test("通知ステータスの毎朝自動リセット用スケジュールが作成される", () => {
    template.hasResourceProperties("AWS::Scheduler::Schedule", {
      ScheduleExpression: "cron(0 7 * * ? *)",
      ScheduleExpressionTimezone: "Asia/Tokyo",
    });
  });

  test("AppSync GraphQL APIが作成される", () => {
    template.resourceCountIs("AWS::AppSync::GraphQLApi", 1);
  });

  test("REST APIが作成される", () => {
    template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
  });
});
