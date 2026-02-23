import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

interface PublishedCommonplaceNotesStackProps extends cdk.StackProps {
	originPath?: string;
}

export class PublishedCommonplaceNotesStack extends cdk.Stack {
	constructor(scope: cdk.App, id: string, props?: PublishedCommonplaceNotesStackProps) {
		super(scope, id, props);

		// Create the S3 bucket with the dynamic name
		const bucket = new s3.Bucket(this, 'PublishedNotesBucket', {
			bucketName: `published-notes-${this.account}-cpn`,
			blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
			encryption: s3.BucketEncryption.S3_MANAGED,
			removalPolicy: cdk.RemovalPolicy.RETAIN,
			versioned: true,
		});

		// Create the CloudFront distribution
		const originPath = props?.originPath || '/';  // default to root
		const distribution = new cloudfront.Distribution(this, 'NotesDistribution', {
			defaultBehavior: {
			origin: new origins.S3Origin(bucket, {
				originPath,
			}),
			viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
			allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
			cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
			compress: true,
			cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
			},
			defaultRootObject: 'index.html',
			httpVersion: cloudfront.HttpVersion.HTTP2,
			priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
			enableIpv6: true,
		});

		// Add the CloudFront OAC to the bucket policy
		bucket.addToResourcePolicy(new iam.PolicyStatement({
			actions: ['s3:GetObject'],
			resources: [bucket.arnForObjects('*')],
			principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
			conditions: {
				StringEquals: {
					'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`
				}
			}
		}));

		// Upload base index.html file to S3
		new s3deploy.BucketDeployment(this, 'DeployWebsite', {
			sources: [s3deploy.Source.asset('./assets/index')],
			destinationBucket: bucket,
			distribution: distribution,
			distributionPaths: ['/*'],
		});

		// Output the CloudFront URL and Distribution ID
		new cdk.CfnOutput(this, 'DistributionDomainName', {
			value: distribution.distributionDomainName,
			description: 'The domain name of the CloudFront distribution'
		});
		new cdk.CfnOutput(this, 'DistributionID', {
			value: distribution.distributionId,
			description: 'The Distribution ID of the CloudFront distribution (you\'ll input this into the Obsidian settings)'
		});
	}
}