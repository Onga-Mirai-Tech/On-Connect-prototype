import { Construct } from "constructs";
import { RemovalPolicy, Duration } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";

export interface AuthConstructProps {
  envName: string;
}

/**
 * ユーザー認証（5.1.1）＋ ロールの大まかな括り（5.1.3）
 * 詳細な権限フラグは DynamoDB Roles テーブル側で管理する。
 */
export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly adminGroup: cognito.CfnUserPoolGroup;
  public readonly memberGroup: cognito.CfnUserPoolGroup;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `on-connect-${props.envName}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      standardAttributes: {
        fullname: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 10,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.userPoolClient = this.userPool.addClient("WebMobileClient", {
      authFlows: { userPassword: true, userSrp: true },
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });

    // Cognitoグループ = 認証レベルの大枠。詳細権限は Roles テーブル(DynamoDB)側で管理（5.1.3）
    this.adminGroup = new cognito.CfnUserPoolGroup(this, "AdminGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "Admin",
      description: "園長・主任等の管理者権限グループ",
    });

    this.memberGroup = new cognito.CfnUserPoolGroup(this, "MemberGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "Member",
      description: "一般メンバーグループ",
    });
  }
}
