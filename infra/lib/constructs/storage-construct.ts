import { Construct } from "constructs";
import { RemovalPolicy, Duration } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";

export interface StorageConstructProps {
  envName: string;
}

/**
 * チャット・掲示板の添付ファイル保存（5.2.1 / 5.3.2）＋ 配信高速化（4.2）
 */
export class StorageConstruct extends Construct {
  public readonly attachmentsBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

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
      ],
      removalPolicy:
        props.envName === "prod" ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: props.envName !== "prod",
    });

    // 添付ファイルは署名付きURLで配信するため、OACでS3への直接アクセスのみ許可する
    this.distribution = new cloudfront.Distribution(this, "AttachmentsDistribution", {
      comment: `on-connect-${props.envName} attachments`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.attachmentsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    });
  }
}
