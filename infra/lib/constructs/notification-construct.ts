import { Construct } from "constructs";
import * as path from "path";
import * as sns from "aws-cdk-lib/aws-sns";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";

export interface NotificationConstructProps {
  envName: string;
  usersTable: dynamodb.Table;
  messagesTable: dynamodb.Table;
  bulletinPostsTable: dynamodb.Table;
}

/**
 * プッシュ通知（4.2 Amazon Pinpoint / Amazon SNS）
 * 通知ON/OFF・緊急通知の制御（5.1.2 / 5.2.3 / 5.3.4）はすべてこの層のLambda内で判定する。
 * 実際のモバイルプッシュ送信（APNs/FCM経由のPinpointエンドポイント登録）は
 * アプリ側のデバイストークン登録実装後に接続する（雛形時点ではSNSトピックまでを用意）。
 */
export class NotificationConstruct extends Construct {
  public readonly pushTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: NotificationConstructProps) {
    super(scope, id);

    this.pushTopic = new sns.Topic(this, "PushNotificationsTopic", {
      topicName: `on-connect-${props.envName}-push-notifications`,
      displayName: "On-Connect Push Notifications",
    });

    // 新規チャット・予約送信完了・緊急通知（forceNotifyがtrueならnotificationStatusを無視）
    const messagePushFn = new lambdaNode.NodejsFunction(this, "MessagePushNotificationFn", {
      entry: path.join(__dirname, "../../lambda/messages/pushNotification.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: {
        USERS_TABLE_NAME: props.usersTable.tableName,
        PUSH_TOPIC_ARN: this.pushTopic.topicArn,
      },
    });
    props.usersTable.grantReadData(messagePushFn);
    this.pushTopic.grantPublish(messagePushFn);
    messagePushFn.addEventSource(
      new DynamoEventSource(props.messagesTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 2,
      }),
    );

    // 掲示板の新規投稿・更新（5.3.4）：閲覧権限を持つメンバーカテゴリ かつ 通知ONのユーザーにのみ送信
    const bulletinPushFn = new lambdaNode.NodejsFunction(this, "BulletinPushNotificationFn", {
      entry: path.join(__dirname, "../../lambda/bulletin/notifyOnPost.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: {
        USERS_TABLE_NAME: props.usersTable.tableName,
        PUSH_TOPIC_ARN: this.pushTopic.topicArn,
      },
    });
    props.usersTable.grantReadData(bulletinPushFn);
    this.pushTopic.grantPublish(bulletinPushFn);
    bulletinPushFn.addEventSource(
      new DynamoEventSource(props.bulletinPostsTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 2,
      }),
    );
  }
}
