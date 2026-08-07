import { Construct } from "constructs";
import { RemovalPolicy, Duration } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";

export interface StorageConstructProps {
  envName: string;
}

/**
 * チャット・掲示板の添付ファイル保存（5.2.1 / 5.3.2）。
 * 配信はCloudFrontではなく、Lambda（Phase 12 `attachments/presign.ts`）が発行するS3署名付き
 * URLをクライアントが直接使う方式（組織規模的にCDNキャッシュの恩恵が薄く、CloudFront Key Group
 * ＋秘密鍵の運用コストを避けるための判断）。そのためCloudFront distributionは設置しない。
 */
export class StorageConstruct extends Construct {
  public readonly attachmentsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageConstructProps) {
    super(scope, id);

    this.attachmentsBucket = new s3.Bucket(this, "AttachmentsBucket", {
      bucketName: undefined, // CDKに自動命名させ、アカウント間の衝突を避ける
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: false,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: "AbortIncompleteMultipartUpload",
          abortIncompleteMultipartUploadAfter: Duration.days(7),
        },
        {
          // チャット添付は期間限定（掲示板添付は手動削除以外では保持し続けるためprefix対象外）
          id: "ExpireChatAttachments",
          prefix: "chat/",
          expiration: Duration.days(365),
        },
      ],
      removalPolicy:
        props.envName === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: props.envName !== "prod",
    });
  }
}
