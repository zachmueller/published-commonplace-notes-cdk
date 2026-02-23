#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PublishedCommonplaceNotesStack } from '../lib/published-commonplace-notes-stack';

const app = new cdk.App();

// Optional: set a variant name to deploy multiple instances into the same account.
// This affects both the CloudFormation stack name and the S3 bucket name.
// Leave undefined for the default deployment.
const variantName: string | undefined = undefined; // e.g., 'MyVariant'

const stackName = variantName
	? `PublishedCommonplaceNotesStack-${variantName}`
	: 'PublishedCommonplaceNotesStack';

new PublishedCommonplaceNotesStack(app, stackName, {
	originPath: '/', // use default of root S3 path in bucket
	variantName,
});
