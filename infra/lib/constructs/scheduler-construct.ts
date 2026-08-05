import { Construct } from "constructs";
import * as path from "path";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";

export interface SchedulerConstructProps {
  envName: string;
  messagesTable: dynamodb.Table;
  usersTable: dynamodb.Table;
  memberDailyStatusTable: dynamodb.Table;
  chatApiUrl: string;
}

/**
 * 予約送信機能（5.2.2）
 * 1. メッセージ作成時に status: scheduled でMessagesテーブルへ保存（AppSync resolver側で実施）
 * 2. Messagesテーブルの DynamoDB Streams をトリガーに、EventBridge Schedulerへ
 *    ワンタイムスケジュールを登録／削除する（このコンストラクト）
 * 3. 指定時刻に Lambda が起動し、status を sent へ更新してプッシュ通知処理を実行する
 *
 * また、通知ステータスの毎朝自動リセット（5.1.2 拡張：メンバーからの要望により追加）も
 * EventBridge Scheduler の定期（cron）スケジュールとしてここで管理する。
 */
export class SchedulerConstruct extends Construct {
  public readonly scheduleGroup: scheduler.CfnScheduleGroup;
  public readonly sendScheduledFn: lambdaNode.NodejsFunction;
  public readonly streamProcessorFn: lambdaNode.NodejsFunction;
  public readonly dailyNotificationResetFn: lambdaNode.NodejsFunction;

  constructor(scope: Construct, id: string, props: SchedulerConstructProps) {
    super(scope, id);

    this.scheduleGroup = new scheduler.CfnScheduleGroup(this, "ScheduleGroup", {
      name: `on-connect-${props.envName}-scheduled-messages`,
    });

    // EventBridge Scheduler が sendScheduledFn を起動するためのロール
    const schedulerInvocationRole = new iam.Role(this, "SchedulerInvocationRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });

    this.sendScheduledFn = new lambdaNode.NodejsFunction(this, "SendScheduledMessageFn", {
      entry: path.join(__dirname, "../../lambda/messages/sendScheduled.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: {
        MESSAGES_TABLE_NAME: props.messagesTable.tableName,
        CHAT_API_URL: props.chatApiUrl,
      },
    });
    props.messagesTable.grantReadWriteData(this.sendScheduledFn);
    this.sendScheduledFn.grantInvoke(schedulerInvocationRole);

    this.streamProcessorFn = new lambdaNode.NodejsFunction(this, "MessageStreamProcessorFn", {
      entry: path.join(__dirname, "../../lambda/messages/onMessageStreamChange.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: {
        SCHEDULE_GROUP_NAME: this.scheduleGroup.name!,
        TARGET_LAMBDA_ARN: this.sendScheduledFn.functionArn,
        SCHEDULER_ROLE_ARN: schedulerInvocationRole.roleArn,
      },
    });

    this.streamProcessorFn.addEventSource(
      new DynamoEventSource(props.messagesTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 2,
      }),
    );

    this.streamProcessorFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["scheduler:CreateSchedule", "scheduler:UpdateSchedule", "scheduler:DeleteSchedule"],
        resources: [
          `arn:aws:scheduler:*:*:schedule/${this.scheduleGroup.name}/*`,
        ],
      }),
    );
    this.streamProcessorFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["iam:PassRole"],
        resources: [schedulerInvocationRole.roleArn],
      }),
    );

    // 通知ステータスの毎朝自動リセット：毎朝7:00（Asia/Tokyo）に実行。
    // 休みが今日始まる人は強制OFF、休み継続中の人は触らない（本人設定を維持）、
    // それ以外の現在OFFの人はONに戻す（休み明けの朝は自然にこの分岐に入る）。
    this.dailyNotificationResetFn = new lambdaNode.NodejsFunction(this, "DailyNotificationResetFn", {
      entry: path.join(__dirname, "../../lambda/users/dailyNotificationReset.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: {
        USERS_TABLE_NAME: props.usersTable.tableName,
        MEMBER_DAILY_STATUS_TABLE_NAME: props.memberDailyStatusTable.tableName,
      },
    });
    props.usersTable.grantReadWriteData(this.dailyNotificationResetFn);
    props.memberDailyStatusTable.grantReadData(this.dailyNotificationResetFn);
    this.dailyNotificationResetFn.grantInvoke(schedulerInvocationRole);

    new scheduler.CfnSchedule(this, "DailyNotificationResetSchedule", {
      name: `on-connect-${props.envName}-daily-notification-reset`,
      groupName: this.scheduleGroup.name,
      flexibleTimeWindow: { mode: "OFF" },
      scheduleExpression: "cron(0 7 * * ? *)",
      scheduleExpressionTimezone: "Asia/Tokyo",
      target: {
        arn: this.dailyNotificationResetFn.functionArn,
        roleArn: schedulerInvocationRole.roleArn,
      },
    });
  }
}
