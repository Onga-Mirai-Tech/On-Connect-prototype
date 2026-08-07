import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib";
import * as path from "path";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as appsync from "aws-cdk-lib/aws-appsync";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";

export interface ApiConstructProps {
  envName: string;
  userPool: cognito.UserPool;
  usersTable: dynamodb.Table;
  rolesTable: dynamodb.Table;
  memberCategoriesTable: dynamodb.Table;
  bulletinPostsTable: dynamodb.Table;
  bulletinCategoriesTable: dynamodb.Table;
  bulletinCommentsTable: dynamodb.Table;
  calendarEventsTable: dynamodb.Table;
  calendarCategoriesTable: dynamodb.Table;
  orgLinksTable: dynamodb.Table;
  callLogsTable: dynamodb.Table;
  dutyTypesTable: dynamodb.Table;
  shiftTypesTable: dynamodb.Table;
  memberDailyStatusTable: dynamodb.Table;
  dailyNotesTable: dynamodb.Table;
  attachmentsBucket: s3.Bucket;
  /** Phase 12: 添付ファイルアップロード時のチャットルームメンバーシップ確認に必要 */
  chatRoomsTable: dynamodb.Table;
  /** Phase 11: initiateCallFnがnotifyIncomingCallをIAM署名付きで呼ぶために必要 */
  chatApi: appsync.GraphqlApi;
  /** Phase 11: 着信のプッシュ通知発行に必要 */
  pushTopic: sns.Topic;
}

/**
 * チャット以外の業務ロジック（ユーザー管理／掲示板／カレンダー／リンク集／通話）を扱う REST API。
 * チャットのリアルタイム部分は AppSync（ChatConstruct）が担当する。
 * カレンダーはGoogleカレンダーとは同期しない独立DB管理で、全メンバーが作成・編集できる。
 */
export class ApiConstruct extends Construct {
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    this.restApi = new apigateway.RestApi(this, "RestApi", {
      restApiName: `on-connect-${props.envName}-api`,
      deployOptions: { stageName: props.envName },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // API Gatewayが認可エラー等でLambdaに到達せず自前で返すレスポンス（401/403等）には
    // defaultCorsPreflightOptionsのCORS設定が効かず、ブラウザからは実際のエラーがCORSエラーとして
    // 見えてしまう（トークン期限切れ時に典型）。DEFAULT_4XX/5XXに明示的にCORSヘッダーを付与して回避する。
    for (const type of [apigateway.ResponseType.DEFAULT_4XX, apigateway.ResponseType.DEFAULT_5XX]) {
      this.restApi.addGatewayResponse(`GatewayResponse-${type.responseType}`, {
        type,
        responseHeaders: { "Access-Control-Allow-Origin": "'*'" },
      });
    }

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "Authorizer", {
      cognitoUserPools: [props.userPool],
    });

    const authOptions: apigateway.MethodOptions = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    const commonEnv = {
      USERS_TABLE_NAME: props.usersTable.tableName,
      ROLES_TABLE_NAME: props.rolesTable.tableName,
      MEMBER_CATEGORIES_TABLE_NAME: props.memberCategoriesTable.tableName,
      USER_POOL_ID: props.userPool.userPoolId,
    };

    // --- ユーザー・ロール・メンバーカテゴリ管理（5.1） ---
    const usersFn = new lambdaNode.NodejsFunction(this, "UsersFn", {
      entry: path.join(__dirname, "../../lambda/users/index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: commonEnv,
    });
    props.usersTable.grantReadWriteData(usersFn);
    props.rolesTable.grantReadWriteData(usersFn);
    props.memberCategoriesTable.grantReadWriteData(usersFn);
    // 職員追加時のCognitoアカウント作成・ログイン状況確認・パスワード再発行（Phase 8a）
    usersFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminDeleteUser",
        ],
        resources: [props.userPool.userPoolArn],
      }),
    );

    const usersResource = this.restApi.root.addResource("users");
    usersResource.addMethod("GET", new apigateway.LambdaIntegration(usersFn), authOptions);
    usersResource.addMethod("POST", new apigateway.LambdaIntegration(usersFn), authOptions);
    const userItem = usersResource.addResource("{userId}");
    userItem.addMethod("GET", new apigateway.LambdaIntegration(usersFn), authOptions);
    userItem.addMethod("PUT", new apigateway.LambdaIntegration(usersFn), authOptions);
    userItem.addMethod("DELETE", new apigateway.LambdaIntegration(usersFn), authOptions);
    const userResetPassword = userItem.addResource("reset-password");
    userResetPassword.addMethod("POST", new apigateway.LambdaIntegration(usersFn), authOptions);

    // ロール・メンバーカテゴリの管理（5.1.3, 5.1.4）も同じLambda（usersFn）が扱う
    const rolesResource = this.restApi.root.addResource("roles");
    rolesResource.addMethod("GET", new apigateway.LambdaIntegration(usersFn), authOptions);
    rolesResource.addMethod("POST", new apigateway.LambdaIntegration(usersFn), authOptions);
    const roleItem = rolesResource.addResource("{roleId}");
    roleItem.addMethod("GET", new apigateway.LambdaIntegration(usersFn), authOptions);
    roleItem.addMethod("PUT", new apigateway.LambdaIntegration(usersFn), authOptions);
    roleItem.addMethod("DELETE", new apigateway.LambdaIntegration(usersFn), authOptions);

    const memberCategoriesResource = this.restApi.root.addResource("member-categories");
    memberCategoriesResource.addMethod("GET", new apigateway.LambdaIntegration(usersFn), authOptions);
    memberCategoriesResource.addMethod("POST", new apigateway.LambdaIntegration(usersFn), authOptions);
    const memberCategoryItem = memberCategoriesResource.addResource("{categoryId}");
    memberCategoryItem.addMethod("GET", new apigateway.LambdaIntegration(usersFn), authOptions);
    memberCategoryItem.addMethod("PUT", new apigateway.LambdaIntegration(usersFn), authOptions);
    memberCategoryItem.addMethod("DELETE", new apigateway.LambdaIntegration(usersFn), authOptions);

    // --- 掲示板CRUD（5.3）：通知送信自体はNotificationConstructがStreams経由で処理 ---
    const bulletinFn = new lambdaNode.NodejsFunction(this, "BulletinFn", {
      entry: path.join(__dirname, "../../lambda/bulletin/crud.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: {
        BULLETIN_POSTS_TABLE_NAME: props.bulletinPostsTable.tableName,
        BULLETIN_CATEGORIES_TABLE_NAME: props.bulletinCategoriesTable.tableName,
        BULLETIN_COMMENTS_TABLE_NAME: props.bulletinCommentsTable.tableName,
        ATTACHMENTS_BUCKET_NAME: props.attachmentsBucket.bucketName,
        // 閲覧者のmemberCategoryIdを引くために参照する（visibleCategoryIdsフィルタ、5.3.3）
        USERS_TABLE_NAME: props.usersTable.tableName,
      },
    });
    props.bulletinPostsTable.grantReadWriteData(bulletinFn);
    props.bulletinCategoriesTable.grantReadWriteData(bulletinFn);
    props.bulletinCommentsTable.grantReadWriteData(bulletinFn);
    props.attachmentsBucket.grantReadWrite(bulletinFn);
    // 添付ファイルが投稿の編集・削除で外れた際にS3側も削除するため（Phase 12、grantReadWriteには
    // s3:DeleteObject*が含まれないため別途必要）
    props.attachmentsBucket.grantDelete(bulletinFn);
    props.usersTable.grantReadData(bulletinFn);

    const bulletinResource = this.restApi.root.addResource("bulletin-posts");
    bulletinResource.addMethod("GET", new apigateway.LambdaIntegration(bulletinFn), authOptions);
    bulletinResource.addMethod("POST", new apigateway.LambdaIntegration(bulletinFn), authOptions);
    const bulletinItem = bulletinResource.addResource("{postId}");
    bulletinItem.addMethod("GET", new apigateway.LambdaIntegration(bulletinFn), authOptions);
    bulletinItem.addMethod("PUT", new apigateway.LambdaIntegration(bulletinFn), authOptions);
    bulletinItem.addMethod("DELETE", new apigateway.LambdaIntegration(bulletinFn), authOptions);
    // コメント（Phase 9、削除・編集は未対応）
    const bulletinCommentsResource = bulletinItem.addResource("comments");
    bulletinCommentsResource.addMethod("GET", new apigateway.LambdaIntegration(bulletinFn), authOptions);
    bulletinCommentsResource.addMethod("POST", new apigateway.LambdaIntegration(bulletinFn), authOptions);
    // リアクション（Phase 9、トグルのみ）
    const bulletinReactionsResource = bulletinItem.addResource("reactions");
    bulletinReactionsResource.addMethod("PUT", new apigateway.LambdaIntegration(bulletinFn), authOptions);

    const bulletinCategoriesResource = this.restApi.root.addResource("bulletin-categories");
    bulletinCategoriesResource.addMethod("GET", new apigateway.LambdaIntegration(bulletinFn), authOptions);
    bulletinCategoriesResource.addMethod("POST", new apigateway.LambdaIntegration(bulletinFn), authOptions);
    const bulletinCategoryItem = bulletinCategoriesResource.addResource("{categoryId}");
    bulletinCategoryItem.addMethod("PUT", new apigateway.LambdaIntegration(bulletinFn), authOptions);
    bulletinCategoryItem.addMethod("DELETE", new apigateway.LambdaIntegration(bulletinFn), authOptions);

    // --- カレンダー（5.4）：独立DB管理、全メンバーが作成・編集・削除できる ---
    const calendarFn = new lambdaNode.NodejsFunction(this, "CalendarFn", {
      entry: path.join(__dirname, "../../lambda/calendar/crud.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: {
        CALENDAR_EVENTS_TABLE_NAME: props.calendarEventsTable.tableName,
        CALENDAR_CATEGORIES_TABLE_NAME: props.calendarCategoriesTable.tableName,
        // 閲覧者のmemberCategoryIdを引くために参照する（visibleCategoryIdsフィルタ）
        USERS_TABLE_NAME: props.usersTable.tableName,
      },
    });
    props.calendarEventsTable.grantReadWriteData(calendarFn);
    props.calendarCategoriesTable.grantReadWriteData(calendarFn);
    props.usersTable.grantReadData(calendarFn);

    const calendarEventsResource = this.restApi.root.addResource("calendar-events");
    calendarEventsResource.addMethod("GET", new apigateway.LambdaIntegration(calendarFn), authOptions);
    calendarEventsResource.addMethod("POST", new apigateway.LambdaIntegration(calendarFn), authOptions);
    const calendarEventItem = calendarEventsResource.addResource("{eventId}");
    calendarEventItem.addMethod("GET", new apigateway.LambdaIntegration(calendarFn), authOptions);
    calendarEventItem.addMethod("PUT", new apigateway.LambdaIntegration(calendarFn), authOptions);
    calendarEventItem.addMethod("DELETE", new apigateway.LambdaIntegration(calendarFn), authOptions);
    const calendarEventIcal = calendarEventItem.addResource("ical");
    calendarEventIcal.addMethod("GET", new apigateway.LambdaIntegration(calendarFn), authOptions);

    const calendarCategoriesResource = this.restApi.root.addResource("calendar-categories");
    calendarCategoriesResource.addMethod("GET", new apigateway.LambdaIntegration(calendarFn), authOptions);
    calendarCategoriesResource.addMethod("POST", new apigateway.LambdaIntegration(calendarFn), authOptions);
    const calendarCategoryItem = calendarCategoriesResource.addResource("{categoryId}");
    calendarCategoryItem.addMethod("PUT", new apigateway.LambdaIntegration(calendarFn), authOptions);
    calendarCategoryItem.addMethod("DELETE", new apigateway.LambdaIntegration(calendarFn), authOptions);

    // --- 外部リンク集（5.5、カレンダーURLの直接掲載を含む） ---
    const linksFn = new lambdaNode.NodejsFunction(this, "OrgLinksFn", {
      entry: path.join(__dirname, "../../lambda/links/crud.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: {
        ORG_LINKS_TABLE_NAME: props.orgLinksTable.tableName,
      },
    });
    props.orgLinksTable.grantReadWriteData(linksFn);

    const linksResource = this.restApi.root.addResource("org-links");
    linksResource.addMethod("GET", new apigateway.LambdaIntegration(linksFn), authOptions);
    linksResource.addMethod("POST", new apigateway.LambdaIntegration(linksFn), authOptions);
    const linkItem = linksResource.addResource("{linkId}");
    linkItem.addMethod("PUT", new apigateway.LambdaIntegration(linksFn), authOptions);
    linkItem.addMethod("DELETE", new apigateway.LambdaIntegration(linksFn), authOptions);

    // --- 1対1音声通話の発信（5.2.4, Amazon Chime SDK） ---
    const initiateCallFn = new lambdaNode.NodejsFunction(this, "InitiateCallFn", {
      entry: path.join(__dirname, "../../lambda/calls/initiateCall.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      // 発信時にChime CreateMeeting/CreateAttendee×2・AppSync通知・SNS publishを直列で呼ぶため、
      // デフォルトの3秒では特にコールドスタート時に間に合わない（実機テストでタイムアウトを確認）
      timeout: Duration.seconds(15),
      environment: {
        CALL_LOGS_TABLE_NAME: props.callLogsTable.tableName,
        USERS_TABLE_NAME: props.usersTable.tableName,
        CHAT_API_URL: props.chatApi.graphqlUrl,
        PUSH_TOPIC_ARN: props.pushTopic.topicArn,
      },
    });
    props.callLogsTable.grantReadWriteData(initiateCallFn);
    props.usersTable.grantReadData(initiateCallFn);
    props.pushTopic.grantPublish(initiateCallFn);
    // Phase 11: notifyIncomingCallをIAM署名付きで呼ぶために必要（Phase 10のdeliverScheduledMessageと同じパターン）
    props.chatApi.grant(initiateCallFn, appsync.IamResource.ofType("Mutation", "notifyIncomingCall"), "appsync:GraphQL");
    initiateCallFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "chime:CreateMeeting",
          "chime:DeleteMeeting",
          "chime:CreateAttendee",
        ],
        resources: ["*"],
      }),
    );

    const callsResource = this.restApi.root.addResource("calls");
    callsResource.addMethod("POST", new apigateway.LambdaIntegration(initiateCallFn), authOptions);
    const callItem = callsResource.addResource("{callId}");
    const callEndResource = callItem.addResource("end");
    callEndResource.addMethod("POST", new apigateway.LambdaIntegration(initiateCallFn), authOptions);

    // --- チャット・掲示板の添付ファイル用、S3署名付きURL発行（5.2.1 / 5.3.2、Phase 12） ---
    const attachmentsFn = new lambdaNode.NodejsFunction(this, "AttachmentsFn", {
      entry: path.join(__dirname, "../../lambda/attachments/presign.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: {
        ATTACHMENTS_BUCKET_NAME: props.attachmentsBucket.bucketName,
        CHAT_ROOMS_TABLE_NAME: props.chatRoomsTable.tableName,
        BULLETIN_POSTS_TABLE_NAME: props.bulletinPostsTable.tableName,
        USERS_TABLE_NAME: props.usersTable.tableName,
      },
    });
    // Put（アップロード署名）・Get（ダウンロード署名）の両方に必要
    props.attachmentsBucket.grantReadWrite(attachmentsFn);
    props.chatRoomsTable.grantReadData(attachmentsFn);
    props.bulletinPostsTable.grantReadData(attachmentsFn);
    props.usersTable.grantReadData(attachmentsFn);

    const attachmentsResource = this.restApi.root.addResource("attachments");
    const attachmentsUploadUrl = attachmentsResource.addResource("upload-url");
    attachmentsUploadUrl.addMethod("POST", new apigateway.LambdaIntegration(attachmentsFn), authOptions);
    const attachmentsDownloadUrl = attachmentsResource.addResource("download-url");
    attachmentsDownloadUrl.addMethod("POST", new apigateway.LambdaIntegration(attachmentsFn), authOptions);

    // --- 休日・当番・シフト管理：全項目manageShifts権限が必要、閲覧のみ全員に開放 ---
    const shiftsFn = new lambdaNode.NodejsFunction(this, "ShiftsFn", {
      entry: path.join(__dirname, "../../lambda/shifts/crud.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_24_X,
      environment: {
        DUTY_TYPES_TABLE_NAME: props.dutyTypesTable.tableName,
        SHIFT_TYPES_TABLE_NAME: props.shiftTypesTable.tableName,
        MEMBER_DAILY_STATUS_TABLE_NAME: props.memberDailyStatusTable.tableName,
        DAILY_NOTES_TABLE_NAME: props.dailyNotesTable.tableName,
        USERS_TABLE_NAME: props.usersTable.tableName,
      },
    });
    props.dutyTypesTable.grantReadWriteData(shiftsFn);
    props.shiftTypesTable.grantReadWriteData(shiftsFn);
    props.memberDailyStatusTable.grantReadWriteData(shiftsFn);
    props.dailyNotesTable.grantReadWriteData(shiftsFn);
    props.usersTable.grantReadData(shiftsFn);

    const dutyTypesResource = this.restApi.root.addResource("duty-types");
    dutyTypesResource.addMethod("GET", new apigateway.LambdaIntegration(shiftsFn), authOptions);
    dutyTypesResource.addMethod("POST", new apigateway.LambdaIntegration(shiftsFn), authOptions);
    const dutyTypeItem = dutyTypesResource.addResource("{dutyTypeId}");
    dutyTypeItem.addMethod("PUT", new apigateway.LambdaIntegration(shiftsFn), authOptions);
    dutyTypeItem.addMethod("DELETE", new apigateway.LambdaIntegration(shiftsFn), authOptions);

    const shiftTypesResource = this.restApi.root.addResource("shift-types");
    shiftTypesResource.addMethod("GET", new apigateway.LambdaIntegration(shiftsFn), authOptions);
    shiftTypesResource.addMethod("POST", new apigateway.LambdaIntegration(shiftsFn), authOptions);
    const shiftTypeItem = shiftTypesResource.addResource("{shiftTypeId}");
    shiftTypeItem.addMethod("PUT", new apigateway.LambdaIntegration(shiftsFn), authOptions);
    shiftTypeItem.addMethod("DELETE", new apigateway.LambdaIntegration(shiftsFn), authOptions);

    const memberDailyStatusResource = this.restApi.root.addResource("member-daily-status");
    memberDailyStatusResource.addMethod("GET", new apigateway.LambdaIntegration(shiftsFn), authOptions);
    const memberDailyStatusDate = memberDailyStatusResource.addResource("{date}");
    const memberDailyStatusItem = memberDailyStatusDate.addResource("{userId}");
    memberDailyStatusItem.addMethod("GET", new apigateway.LambdaIntegration(shiftsFn), authOptions);
    memberDailyStatusItem.addMethod("PUT", new apigateway.LambdaIntegration(shiftsFn), authOptions);
    memberDailyStatusItem.addMethod("DELETE", new apigateway.LambdaIntegration(shiftsFn), authOptions);

    const dailyNotesResource = this.restApi.root.addResource("daily-notes");
    const dailyNotesItem = dailyNotesResource.addResource("{date}");
    dailyNotesItem.addMethod("GET", new apigateway.LambdaIntegration(shiftsFn), authOptions);
    dailyNotesItem.addMethod("PUT", new apigateway.LambdaIntegration(shiftsFn), authOptions);
    dailyNotesItem.addMethod("DELETE", new apigateway.LambdaIntegration(shiftsFn), authOptions);
  }
}
