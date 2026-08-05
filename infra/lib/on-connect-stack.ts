import { Construct } from "constructs";
import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { AuthConstruct } from "./constructs/auth-construct";
import { DatabaseConstruct } from "./constructs/database-construct";
import { StorageConstruct } from "./constructs/storage-construct";
import { ChatConstruct } from "./constructs/chat-construct";
import { SchedulerConstruct } from "./constructs/scheduler-construct";
import { NotificationConstruct } from "./constructs/notification-construct";
import { ApiConstruct } from "./constructs/api-construct";

export interface OnConnectStackProps extends StackProps {
  envName: string;
}

export class OnConnectStack extends Stack {
  constructor(scope: Construct, id: string, props: OnConnectStackProps) {
    super(scope, id, props);

    const { envName } = props;

    const auth = new AuthConstruct(this, "Auth", { envName });
    const db = new DatabaseConstruct(this, "Database", envName);
    const storage = new StorageConstruct(this, "Storage", { envName });

    const chat = new ChatConstruct(this, "Chat", {
      envName,
      userPool: auth.userPool,
      chatRoomsTable: db.chatRoomsTable,
      messagesTable: db.messagesTable,
    });

    new SchedulerConstruct(this, "Scheduler", {
      envName,
      messagesTable: db.messagesTable,
      usersTable: db.usersTable,
      memberDailyStatusTable: db.memberDailyStatusTable,
      chatApiUrl: chat.api.graphqlUrl,
    });

    new NotificationConstruct(this, "Notification", {
      envName,
      usersTable: db.usersTable,
      messagesTable: db.messagesTable,
      bulletinPostsTable: db.bulletinPostsTable,
    });

    const api = new ApiConstruct(this, "Api", {
      envName,
      userPool: auth.userPool,
      usersTable: db.usersTable,
      rolesTable: db.rolesTable,
      memberCategoriesTable: db.memberCategoriesTable,
      bulletinPostsTable: db.bulletinPostsTable,
      bulletinCategoriesTable: db.bulletinCategoriesTable,
      calendarEventsTable: db.calendarEventsTable,
      calendarCategoriesTable: db.calendarCategoriesTable,
      orgLinksTable: db.orgLinksTable,
      callLogsTable: db.callLogsTable,
      dutyTypesTable: db.dutyTypesTable,
      shiftTypesTable: db.shiftTypesTable,
      memberDailyStatusTable: db.memberDailyStatusTable,
      attachmentsBucket: storage.attachmentsBucket,
    });

    new CfnOutput(this, "UserPoolId", { value: auth.userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: auth.userPoolClient.userPoolClientId });
    new CfnOutput(this, "GraphqlApiUrl", { value: chat.api.graphqlUrl });
    new CfnOutput(this, "RestApiUrl", { value: api.restApi.url });
    new CfnOutput(this, "AttachmentsBucketName", { value: storage.attachmentsBucket.bucketName });
    new CfnOutput(this, "AttachmentsDistributionDomain", {
      value: storage.distribution.distributionDomainName,
    });
  }
}
