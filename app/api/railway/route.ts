/**
 * Railway Control API
 * Start/Stop Railway service via API
 */

import { NextRequest, NextResponse } from 'next/server';

const RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';

// These should be set in Vercel environment variables
const RAILWAY_TOKEN = process.env.RAILWAY_API_TOKEN;
const RAILWAY_PROJECT_ID = process.env.RAILWAY_PROJECT_ID;
const RAILWAY_SERVICE_ID = process.env.RAILWAY_SERVICE_ID;
const RAILWAY_ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID || 'production';

async function railwayQuery(query: string, variables?: Record<string, any>) {
    if (!RAILWAY_TOKEN) {
        throw new Error('RAILWAY_API_TOKEN not configured');
    }

    const response = await fetch(RAILWAY_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${RAILWAY_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
    });

    const data = await response.json();

    if (data.errors) {
        throw new Error(data.errors[0]?.message || 'Railway API error');
    }

    return data.data;
}

// Get service status
async function getServiceStatus() {
    const query = `
        query getService($serviceId: String!) {
            service(id: $serviceId) {
                id
                name
                deployments(first: 1) {
                    edges {
                        node {
                            id
                            status
                            createdAt
                        }
                    }
                }
            }
        }
    `;

    const data = await railwayQuery(query, { serviceId: RAILWAY_SERVICE_ID });
    return data?.service;
}

// Redeploy service (start)
async function startService() {
    const query = `
        mutation deployService($serviceId: String!, $environmentId: String!) {
            serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId)
        }
    `;

    await railwayQuery(query, {
        serviceId: RAILWAY_SERVICE_ID,
        environmentId: RAILWAY_ENVIRONMENT_ID,
    });
}

// Remove deployment (stop) - This pauses the service
async function stopService() {
    // Get latest deployment
    const service = await getServiceStatus();
    const latestDeployment = service?.deployments?.edges?.[0]?.node;

    if (!latestDeployment) {
        throw new Error('No deployment found');
    }

    const query = `
        mutation removeDeployment($deploymentId: String!) {
            deploymentRemove(id: $deploymentId)
        }
    `;

    await railwayQuery(query, { deploymentId: latestDeployment.id });
}

export async function GET() {
    try {
        if (!RAILWAY_TOKEN || !RAILWAY_SERVICE_ID) {
            return NextResponse.json({
                configured: false,
                error: 'Railway API not configured. Set RAILWAY_API_TOKEN and RAILWAY_SERVICE_ID in Vercel.',
            });
        }

        const service = await getServiceStatus();
        const latestDeployment = service?.deployments?.edges?.[0]?.node;

        return NextResponse.json({
            configured: true,
            serviceName: service?.name,
            status: latestDeployment?.status || 'UNKNOWN',
            lastDeployAt: latestDeployment?.createdAt,
        });
    } catch (error: any) {
        return NextResponse.json({
            configured: true,
            error: error.message,
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { action } = await request.json();

        if (!RAILWAY_TOKEN || !RAILWAY_SERVICE_ID) {
            return NextResponse.json({
                error: 'Railway API not configured',
            }, { status: 400 });
        }

        if (action === 'start') {
            await startService();
            return NextResponse.json({ success: true, message: 'Service starting...' });
        }

        if (action === 'stop') {
            await stopService();
            return NextResponse.json({ success: true, message: 'Service stopped' });
        }

        return NextResponse.json({ error: 'Invalid action. Use "start" or "stop"' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
