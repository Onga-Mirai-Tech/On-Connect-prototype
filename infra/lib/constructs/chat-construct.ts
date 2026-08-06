import { Construct } from "constructs";
import * as path from "path";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";

export interface ChatConstructProps {
  envName: string;
  userPool: cognito.UserPool;
  chatRoomsTable: dynamodb.Table;
  messagesTable: dynamodb.Table;
}

/**
 * リアルタイムチャット（5.2）。AWS AppSync（GraphQL Subscriptions）で新着メッセージ・既読を配信する。
 * 予約送信のEventBridge Scheduler登録は Messages テーブルの DynamoDB Streams をトリガーに
 * 行う（lambda/messages/onMessageStreamChange.ts）ため、ここでは素直なCRUD resolverのみを持つ。
 */
export class ChatConstruct extends Construct {
  public readonly api: appsync.GraphqlApi;

  constructor(scope: Construct, id: string, props: ChatConstructProps) {
    super(scope, id);

    this.api = new appsync.GraphqlApi(this, "ChatApi", {
      name: `on-connect-${props.envName}-chat`,
      definition: appsync.Definition.fromFile(
        path.join(__dirname, "../../graphql/schema.graphql"),
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool: props.userPool },
        },
      },
      logConfig: { fieldLogLevel: appsync.FieldLogLevel.ERROR },
      xrayEnabled: true,
    });

    const chatRoomsDS = this.api.addDynamoDbDataSource(
      "ChatRoomsDataSource",
      props.chatRoomsTable,
    );
    const messagesDS = this.api.addDynamoDbDataSource(
      "MessagesDataSource",
      props.messagesTable,
    );

    chatRoomsDS.createResolver("GetChatRoomResolver", {
      typeName: "Query",
      fieldName: "getChatRoom",
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem(
        "roomId",
        "roomId",
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    // 自分が参加しているルーム一覧（Phase 8d）。GSIは追加せず全件スキャン+フィルタで済ませる
    // （dailyReminder.tsがCalendarEventsTableを全件スキャンしている前例と同じ、小規模組織向けの簡略化）
    chatRoomsDS.createResolver("ListChatRoomsForUserResolver", {
      typeName: "Query",
      fieldName: "listChatRoomsForUser",
      requestMappingTemplate: appsync.MappingTemplate.fromString(`{
  "version": "2018-05-29",
  "operation": "Scan",
  "filter": {
    "expression": "contains(memberUserIds, :userId)",
    "expressionValues": { ":userId": $util.dynamodb.toDynamoDBJson($ctx.args.userId) }
  }
}`),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        "$util.toJson($ctx.result.items)",
      ),
    });

    // ルーム作成（1対1・グループ共通、Phase 8d）。1:1の重複作成防止はフロント側の責務
    chatRoomsDS.createResolver("CreateRoomResolver", {
      typeName: "Mutation",
      fieldName: "createRoom",
      requestMappingTemplate: appsync.MappingTemplate.fromString(`{
  "version": "2018-05-29",
  "operation": "PutItem",
  "key": {
    "roomId": $util.dynamodb.toDynamoDBJson($util.autoId())
  },
  "attributeValues": {
    "isGroup": $util.dynamodb.toDynamoDBJson($ctx.args.input.isGroup),
    "name": $util.dynamodb.toDynamoDBJson($ctx.args.input.name),
    "memberUserIds": $util.dynamodb.toDynamoDBJson($ctx.args.input.memberUserIds),
    "createdAt": $util.dynamodb.toDynamoDBJson($util.time.nowISO8601())
  }
}`),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    messagesDS.createResolver("ListMessagesForRoomResolver", {
      typeName: "Query",
      fieldName: "listMessagesForRoom",
      requestMappingTemplate: appsync.MappingTemplate.fromString(`{
  "version": "2018-05-29",
  "operation": "Query",
  "query": {
    "expression": "roomId = :roomId",
    "expressionValues": { ":roomId": $util.dynamodb.toDynamoDBJson($ctx.args.roomId) }
  },
  "limit": $util.defaultIfNull($ctx.args.limit, 50),
  "nextToken": $util.toJson($util.defaultIfNullOrEmpty($ctx.args.nextToken, null)),
  "scanIndexForward": true
}`),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        "$util.toJson($ctx.result.items)",
      ),
    });

    messagesDS.createResolver("SendMessageResolver", {
      typeName: "Mutation",
      fieldName: "sendMessage",
      requestMappingTemplate: appsync.MappingTemplate.fromString(`{
  "version": "2018-05-29",
  "operation": "PutItem",
  "key": {
    "roomId": $util.dynamodb.toDynamoDBJson($ctx.args.input.roomId),
    "messageId": $util.dynamodb.toDynamoDBJson($util.autoId())
  },
  "attributeValues": {
    "senderId": $util.dynamodb.toDynamoDBJson($ctx.args.input.senderId),
    "body": $util.dynamodb.toDynamoDBJson($ctx.args.input.body),
    "attachmentKeys": $util.dynamodb.toDynamoDBJson($util.defaultIfNull($ctx.args.input.attachmentKeys, [])),
    "readByUserIds": $util.dynamodb.toDynamoDBJson([]),
    "status": $util.dynamodb.toDynamoDBJson($util.isNull($ctx.args.input.scheduledAt) ? "sent" : "scheduled"),
    "scheduledAt": $util.dynamodb.toDynamoDBJson($ctx.args.input.scheduledAt),
    "forceNotify": $util.dynamodb.toDynamoDBJson($util.defaultIfNull($ctx.args.input.forceNotify, false)),
    "mentionedUserIds": $util.dynamodb.toDynamoDBJson($util.defaultIfNull($ctx.args.input.mentionedUserIds, [])),
    "createdAt": $util.dynamodb.toDynamoDBJson($util.time.nowISO8601())
  }
}`),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    messagesDS.createResolver("MarkMessageReadResolver", {
      typeName: "Mutation",
      fieldName: "markMessageRead",
      requestMappingTemplate: appsync.MappingTemplate.fromString(`{
  "version": "2018-05-29",
  "operation": "UpdateItem",
  "key": {
    "roomId": $util.dynamodb.toDynamoDBJson($ctx.args.input.roomId),
    "messageId": $util.dynamodb.toDynamoDBJson($ctx.args.input.messageId)
  },
  "update": {
    "expression": "SET readByUserIds = list_append(if_not_exists(readByUserIds, :empty), :userId)",
    "expressionValues": {
      ":userId": $util.dynamodb.toDynamoDBJson([$ctx.args.input.userId]),
      ":empty": $util.dynamodb.toDynamoDBJson([])
    }
  }
}`),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });

    // 予約送信の取消（削除）。削除イベントは Streams 経由で EventBridge Schedule も併せて削除する
    messagesDS.createResolver("CancelScheduledMessageResolver", {
      typeName: "Mutation",
      fieldName: "cancelScheduledMessage",
      requestMappingTemplate: appsync.MappingTemplate.fromString(`{
  "version": "2018-05-29",
  "operation": "DeleteItem",
  "key": {
    "roomId": $util.dynamodb.toDynamoDBJson($ctx.args.roomId),
    "messageId": $util.dynamodb.toDynamoDBJson($ctx.args.messageId)
  },
  "condition": {
    "expression": "#status = :scheduled",
    "expressionNames": { "#status": "status" },
    "expressionValues": { ":scheduled": $util.dynamodb.toDynamoDBJson("scheduled") }
  }
}`),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });
  }
}
