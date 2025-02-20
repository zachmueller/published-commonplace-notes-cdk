#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PublishedCommonplaceNotesStack } from '../lib/published-commonplace-notes-stack';

const app = new cdk.App();

new PublishedCommonplaceNotesStack(app, 'PublishedCommonplaceNotesStack-Prod', {
	originPath: '/' // use default of root S3 path in bucket
});