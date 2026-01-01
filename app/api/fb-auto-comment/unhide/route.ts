/**
 * API route for unhiding Facebook comments
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    unhideComment,
    getHiddenComments,
    unhideAllCommentsOnPost,
    unhideAllPageComments,
    getCommentsWithStatus
} from '@/lib/fb-auto-comment/facebook';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, accessToken, pageId, postId, commentId } = body;

        if (!accessToken) {
            return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
        }

        switch (action) {
            case 'unhideComment': {
                if (!commentId) {
                    return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 });
                }
                const result = await unhideComment(commentId, accessToken);
                return NextResponse.json(result);
            }

            case 'getHiddenComments': {
                if (!postId) {
                    return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
                }
                const comments = await getHiddenComments(postId, accessToken);
                return NextResponse.json({ comments, count: comments.length });
            }

            case 'getCommentsWithStatus': {
                if (!postId) {
                    return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
                }
                const comments = await getCommentsWithStatus(postId, accessToken);
                const hidden = comments.filter(c => c.is_hidden);
                const visible = comments.filter(c => !c.is_hidden);
                return NextResponse.json({
                    comments,
                    total: comments.length,
                    hidden: hidden.length,
                    visible: visible.length
                });
            }

            case 'unhideAllOnPost': {
                if (!postId) {
                    return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
                }
                const result = await unhideAllCommentsOnPost(postId, accessToken, pageId);
                return NextResponse.json(result);
            }

            case 'unhideAllPageComments': {
                if (!pageId) {
                    return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
                }
                const maxPosts = body.maxPosts || 50;
                const result = await unhideAllPageComments(pageId, accessToken, maxPosts);
                return NextResponse.json(result);
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Error in unhide comments API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
