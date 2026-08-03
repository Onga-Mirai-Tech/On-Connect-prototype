import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

/**
 * 8章「データ設計（主要テーブル例）」に対応するDynamoDBテーブル群。
 * すべてオンデマンド課金（PAY_PER_REQUEST）とし、35人規模の想定利用料に合わせる（9章）。
 */
export class DatabaseConstruct extends Construct {
  public readonly usersTable: dynamodb.Table;
  public readonly rolesTable: dynamodb.Table;
  public readonly memberCategoriesTable: dynamodb.Table;
  public readonly chatRoomsTable: dynamodb.Table;
  public readonly messagesTable: dynamodb.Table;
  public readonly bulletinPostsTable: dynamodb.Table;
  public readonly scheduleCacheTable: dynamodb.Table;
  public readonly callLogsTable: dynamodb.Table;
  public readonly orgLinksTable: dynamodb.Table;
  public readonly orgSettingsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, envName: string) {
    super(scope, id);

    const commonProps: Partial<dynamodb.TableProps> = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy:
        envName === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    };

    this.usersTable = new dynamodb.Table(this, "UsersTable", {
      ...commonProps,
      tableName: `on-connect-${envName}-Users`,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
    });

    this.rolesTable = new dynamodb.Table(this, "RolesTable", {
      ...commonProps,
      tableName: `on-connect-${envName}-Roles`,
      partitionKey: { name: "roleId", type: dynamodb.AttributeType.STRING },
    });

    this.memberCategoriesTable = new dynamodb.Table(this, "MemberCategoriesTable", {
      ...commonProps,
      tableName: `on-connect-${envName}-MemberCategories`,
      partitionKey: { name: "categoryId", type: dynamodb.AttributeType.STRING },
    });

    this.chatRoomsTable = new dynamodb.Table(this, "ChatRoomsTable", {
      ...commonProps,
      tableName: `on-connect-${envName}-ChatRooms`,
      partitionKey: { name: "roomId", type: dynamodb.AttributeType.STRING },
    });

    // 予約送信（scheduledAt）・緊急通知（forceNotify）を扱うため DynamoDB Streams を有効化
    this.messagesTable = new dynamodb.Table(this, "MessagesTable", {
      ...commonProps,
      tableName: `on-connect-${envName}-Messages`,
      partitionKey: { name: "roomId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "messageId", type: dynamodb.AttributeType.STRING },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // 新規投稿・更新時のプッシュ通知（5.3.4）のため DynamoDB Streams を有効化
    this.bulletinPostsTable = new dynamodb.Table(this, "BulletinPostsTable", {
      ...commonProps,
      tableName: `on-connect-${envName}-BulletinPosts`,
      partitionKey: { name: "postId", type: dynamodb.AttributeType.STRING },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    this.scheduleCacheTable = new dynamodb.Table(this, "ScheduleCacheTable", {
      ...commonProps,
      tableName: `on-connect-${envName}-ScheduleCache`,
      partitionKey: { name: "calendarId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "eventId", type: dynamodb.AttributeType.STRING },
    });

    this.callLogsTable = new dynamodb.Table(this, "CallLogsTable", {
      ...commonProps,
      tableName: `on-connect-${envName}-CallLogs`,
      partitionKey: { name: "callId", type: dynamodb.AttributeType.STRING },
    });

    this.orgLinksTable = new dynamodb.Table(this, "OrgLinksTable", {
      ...commonProps,
      tableName: `on-connect-${envName}-OrgLinks`,
      partitionKey: { name: "linkId", type: dynamodb.AttributeType.STRING },
    });

    // 組織単位の設定値（表示するGoogleカレンダーのID 等）を保持する単一項目ストア
    this.orgSettingsTable = new dynamodb.Table(this, "OrgSettingsTable", {
      ...commonProps,
      tableName: `on-connect-${envName}-OrgSettings`,
      partitionKey: { name: "settingId", type: dynamodb.AttributeType.STRING },
    });
  }
}
