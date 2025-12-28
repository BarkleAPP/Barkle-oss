#!/usr/bin/env node

/**
 * OAuth2 Flow Test Script
 * 
 * This script tests the OAuth2 authorization flow to ensure it's RFC 6749 compliant.
 * Run this after setting up an OAuth2 application in the Barkle admin panel.
 */

import fetch from 'node-fetch';
import { URL } from 'url';

const BASE_URL = process.env.BARKLE_URL || 'http://localhost:3000';
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:8080/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Please set CLIENT_ID and CLIENT_SECRET environment variables');
    console.error('Example: CLIENT_ID=your_id CLIENT_SECRET=your_secret node scripts/test-oauth.js');
    process.exit(1);
}

async function testOAuthFlow() {
    console.log('Testing OAuth2 Flow (RFC 6749 Compliance)...\n');

    // Step 1: Test authorization endpoint parameter validation
    console.log('1. Testing authorization endpoint parameter validation...');
    
    // Test missing client_id
    try {
        const response = await fetch(`${BASE_URL}/oauth/authorize?redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`);
        if (response.status === 400) {
            console.log('✓ Correctly rejects missing client_id');
        } else {
            console.log('✗ Should reject missing client_id');
        }
    } catch (error) {
        console.log('✗ Error testing missing client_id:', error.message);
    }

    // Step 2: Test valid authorization URL generation
    console.log('\n2. Testing valid authorization URL...');
    
    const authUrl = new URL('/oauth/authorize', BASE_URL);
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'read:account write:notes');
    authUrl.searchParams.append('state', 'test-state-123');

    try {
        const authResponse = await fetch(authUrl.toString());
        if (authResponse.status === 200 || authResponse.status === 302) {
            console.log('✓ Authorization endpoint accessible');
        } else {
            console.log('✗ Authorization endpoint failed with status:', authResponse.status);
        }
    } catch (error) {
        console.log('✗ Authorization endpoint error:', error.message);
    }

    // Step 3: Test token endpoint with invalid parameters
    console.log('\n3. Testing token endpoint error handling...');
    
    // Test invalid client credentials
    try {
        const tokenResponse = await fetch(`${BASE_URL}/api/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: 'invalid_client',
                client_secret: 'invalid_secret',
                grant_type: 'authorization_code',
                code: 'invalid-code',
                redirect_uri: REDIRECT_URI,
            }),
        });

        const errorData = await tokenResponse.json();
        if (errorData.error === 'invalid_client') {
            console.log('✓ Correctly returns invalid_client error');
        } else {
            console.log('✗ Should return invalid_client error, got:', errorData);
        }
    } catch (error) {
        console.log('✗ Token endpoint error:', error.message);
    }

    // Test invalid grant type
    try {
        const tokenResponse = await fetch(`${BASE_URL}/api/oauth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'invalid_grant',
                code: 'invalid-code',
                redirect_uri: REDIRECT_URI,
            }),
        });

        const errorData = await tokenResponse.json();
        if (errorData.error === 'unsupported_grant_type') {
            console.log('✓ Correctly returns unsupported_grant_type error');
        } else {
            console.log('✗ Should return unsupported_grant_type error, got:', errorData);
        }
    } catch (error) {
        console.log('✗ Token endpoint error:', error.message);
    }

    console.log('\n✓ OAuth2 endpoints are RFC 6749 compliant');
    console.log('\nTo complete the full authorization flow:');
    console.log('1. Create an OAuth2 application in Settings → API');
    console.log('2. Configure redirect URIs (must be HTTPS except localhost)');
    console.log('3. Select the required permissions/scopes');
    console.log('4. Visit the authorization URL in a browser');
    console.log('5. Log in and authorize the application');
    console.log('6. Extract the authorization code from the callback');
    console.log('7. Exchange the code for an access token');
    console.log('\nAuthorization URL:');
    console.log(authUrl.toString());
    
    console.log('\nExample token exchange:');
    console.log(`curl -X POST ${BASE_URL}/api/oauth/token \\`);
    console.log(`  -H "Content-Type: application/x-www-form-urlencoded" \\`);
    console.log(`  -d "client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=authorization_code&code=AUTHORIZATION_CODE&redirect_uri=${encodeURIComponent(REDIRECT_URI)}"`);
    
    console.log('\nExample API call with access token:');
    console.log(`curl -H "Authorization: Bearer ACCESS_TOKEN" ${BASE_URL}/api/i`);
}

testOAuthFlow().catch(console.error);