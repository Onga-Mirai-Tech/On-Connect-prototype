import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
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

  test("添付ファイル用S3バケットにchat/限定365日ライフサイクルルールがある（Phase 12）", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            Id: "ExpireChatAttachments",
            Prefix: "chat/",
            ExpirationInDays: 365,
          }),
        ]),
      },
    });
  });

  test("添付ファイルアップロード/ダウンロードURL発行用のREST APIルートが作成される（Phase 12）", () => {
    template.hasResourceProperties("AWS::ApiGateway::Resource", { PathPart: "attachments" });
    template.hasResourceProperties("AWS::ApiGateway::Resource", { PathPart: "upload-url" });
    template.hasResourceProperties("AWS::ApiGateway::Resource", { PathPart: "download-url" });
  });
});
