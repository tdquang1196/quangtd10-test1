/**
 * Facebook Graph API service
 */

import { FBPost } from './types';

const API_VERSION = 'v18.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

interface PaginatedResponse<T> {
    data: T[];
    paging?: {
        next?: string;
    };
}

/**
 * Get all posts from a page (includes privacy info)
 */
export async function getAllPosts(pageId: string, accessToken: string): Promise<FBPost[]> {
    const allPosts: FBPost[] = [];
    // Added privacy field to detect Only Me posts
    let nextUrl: string | null = `${BASE_URL}/${pageId}/posts?fields=id,message,created_time,privacy&limit=25&access_token=${accessToken}`;

    while (nextUrl) {
        try {
            const response = await fetch(nextUrl);
            const data: PaginatedResponse<FBPost> = await response.json();

            if ((data as any).error) {
                throw new Error((data as any).error.message);
            }

            allPosts.push(...data.data);
            nextUrl = data.paging?.next || null;

            // Rate limit protection
            if (nextUrl) {
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (error) {
            console.error('Error fetching posts:', error);
            break;
        }
    }

    return allPosts;
}

/**
 * Get all videos/reels from a page (includes privacy info)
 */
export async function getAllVideos(pageId: string, accessToken: string): Promise<FBPost[]> {
    const allVideos: FBPost[] = [];
    // Added privacy field to detect Only Me videos
    let nextUrl: string | null = `${BASE_URL}/${pageId}/videos?fields=id,description,created_time,privacy&limit=25&access_token=${accessToken}`;

    while (nextUrl) {
        try {
            const response = await fetch(nextUrl);
            const data: PaginatedResponse<any> = await response.json();

            if ((data as any).error) {
                throw new Error((data as any).error.message);
            }

            const videos: FBPost[] = data.data.map((v: any) => ({
                id: v.id,
                message: v.description,
                created_time: v.created_time,
                privacy: v.privacy, // Thêm privacy
            }));

            allVideos.push(...videos);
            nextUrl = data.paging?.next || null;

            if (nextUrl) {
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (error) {
            console.error('Error fetching videos:', error);
            break;
        }
    }

    return allVideos;
}

/**
 * Get all content (posts + videos)
 */
export async function getAllContent(pageId: string, accessToken: string): Promise<FBPost[]> {
    const [posts, videos] = await Promise.all([
        getAllPosts(pageId, accessToken),
        getAllVideos(pageId, accessToken),
    ]);

    const postIds = new Set(posts.map(p => p.id));
    const allContent = [...posts];

    videos.forEach(video => {
        if (!postIds.has(video.id)) {
            allContent.push(video);
        }
    });

    return allContent;
}

/**
 * Get page's comments on a post (with full pagination)
 * Uses filter=toplevel to get only top-level comments (not replies)
 * @param afterTime - Optional ISO timestamp to filter comments created after this time
 */
export async function getPageCommentsOnPost(
    postId: string,
    pageId: string,
    accessToken: string,
    afterTime?: string
): Promise<string[]> {
    const comments: string[] = [];
    // filter=toplevel gets only top-level comments (not replies)
    // Include is_hidden field to detect hidden/spam comments
    let nextUrl: string | null = `${BASE_URL}/${postId}/comments?fields=id,message,from,created_time,is_hidden,can_hide&filter=toplevel&limit=200&access_token=${accessToken}`;
    let pageCount = 0;
    const maxPages = 20; // Safety limit to prevent infinite loops
    const afterTimeMs = afterTime ? new Date(afterTime).getTime() : null;

    let totalComments = 0;
    let hiddenCount = 0;
    let fromOthersCount = 0;

    console.log(`[getPageCommentsOnPost] Fetching comments for post ${postId}, afterTime: ${afterTime || 'none'}`);

    while (nextUrl && pageCount < maxPages) {
        try {
            const response = await fetch(nextUrl);
            const data: PaginatedResponse<any> = await response.json();

            if ((data as any).error) {
                console.error('Error fetching comments:', (data as any).error);
                break;
            }

            totalComments += data.data.length;

            // Log hidden comments for debugging
            const hiddenComments = data.data.filter((c: any) => c.is_hidden === true);
            hiddenCount += hiddenComments.length;
            if (hiddenComments.length > 0) {
                console.log(`[getPageCommentsOnPost] Found ${hiddenComments.length} HIDDEN comments:`,
                    hiddenComments.map((c: any) => ({ id: c.id, from: c.from?.name, message: c.message?.substring(0, 50) }))
                );
            }

            // Log comments from others (not from page)
            const fromOthers = data.data.filter((c: any) => c.from?.id !== pageId);
            fromOthersCount += fromOthers.length;
            if (fromOthers.length > 0) {
                console.log(`[getPageCommentsOnPost] Found ${fromOthers.length} comments from OTHER users (not page):`,
                    fromOthers.map((c: any) => ({ id: c.id, from: c.from?.name, fromId: c.from?.id, message: c.message?.substring(0, 50) }))
                );
            }

            // Filter to only page's comments (excluding hidden ones)
            let filteredComments = data.data.filter((c: any) => c.from?.id === pageId && c.is_hidden !== true);

            // If afterTime is specified, filter comments created after that time
            if (afterTimeMs) {
                const beforeFilter = filteredComments.length;
                filteredComments = filteredComments.filter((c: any) => {
                    const commentTime = new Date(c.created_time).getTime();
                    return commentTime > afterTimeMs;
                });
                console.log(`[getPageCommentsOnPost] Page ${pageCount + 1}: Filtered ${beforeFilter} -> ${filteredComments.length} comments (by time)`);
            }

            const pageComments = filteredComments.map((c: any) => c.message);

            comments.push(...pageComments);
            nextUrl = data.paging?.next || null;
            pageCount++;

            // Add delay to avoid rate limiting
            if (nextUrl) {
                await new Promise(r => setTimeout(r, 500));
            }
        } catch (error) {
            console.error('Error in getPageCommentsOnPost:', error);
            break;
        }
    }

    console.log(`[getPageCommentsOnPost] Post ${postId} SUMMARY:`);
    console.log(`  - Total comments from API: ${totalComments}`);
    console.log(`  - Hidden comments: ${hiddenCount}`);
    console.log(`  - Comments from other users: ${fromOthersCount}`);
    console.log(`  - Valid page comments: ${comments.length}`);
    return comments;
}

/**
 * Post a comment
 */
export async function postComment(
    postId: string,
    message: string,
    accessToken: string
): Promise<{ id: string | null; error?: string }> {
    try {
        const response = await fetch(`${BASE_URL}/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                access_token: accessToken,
            }),
        });

        const data = await response.json();

        if (data.error) {
            const errorMsg = `[${data.error.code || 'unknown'}] ${data.error.message}`;
            console.error(`Error posting comment to ${postId}:`, errorMsg);
            return { id: null, error: errorMsg };
        }

        return { id: data.id };
    } catch (error: any) {
        console.error('Error posting comment:', error);
        return { id: null, error: error.message };
    }
}

/**
 * Verify page access
 */
export async function verifyAccess(
    pageId: string,
    accessToken: string
): Promise<{ success: boolean; pageName?: string; error?: string }> {
    try {
        const response = await fetch(
            `${BASE_URL}/${pageId}?fields=id,name&access_token=${accessToken}`
        );
        const data = await response.json();

        if (data.error) {
            return { success: false, error: data.error.message };
        }

        return { success: true, pageName: data.name };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Unhide a specific comment
 * @param commentId - The ID of the comment to unhide
 * @param accessToken - Page access token
 */
export async function unhideComment(
    commentId: string,
    accessToken: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(`${BASE_URL}/${commentId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                is_hidden: 'false',
                access_token: accessToken,
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.error(`Error unhiding comment ${commentId}:`, data.error.message);
            return { success: false, error: data.error.message };
        }

        console.log(`[unhideComment] Successfully unhid comment ${commentId}`);
        return { success: true };
    } catch (error: any) {
        console.error('Error unhiding comment:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all comments on a post (including hidden ones) with is_hidden status
 */
export async function getCommentsWithStatus(
    postId: string,
    accessToken: string
): Promise<{ id: string; message: string; is_hidden: boolean; from?: { id: string; name: string }; created_time: string }[]> {
    const comments: any[] = [];
    let nextUrl: string | null = `${BASE_URL}/${postId}/comments?fields=id,message,from,created_time,is_hidden,can_hide&limit=200&access_token=${accessToken}`;
    let pageCount = 0;
    const maxPages = 10;

    while (nextUrl && pageCount < maxPages) {
        try {
            const response: Response = await fetch(nextUrl);
            const data: any = await response.json();

            if (data.error) {
                console.error('Error fetching comments:', data.error);
                break;
            }

            comments.push(...data.data);
            nextUrl = data.paging?.next || null;
            pageCount++;

            if (nextUrl) {
                await new Promise(r => setTimeout(r, 500));
            }
        } catch (error) {
            console.error('Error in getCommentsWithStatus:', error);
            break;
        }
    }

    return comments;
}

/**
 * Get all hidden comments on a post
 */
export async function getHiddenComments(
    postId: string,
    accessToken: string
): Promise<{ id: string; message: string; from?: { id: string; name: string }; created_time: string }[]> {
    const allComments = await getCommentsWithStatus(postId, accessToken);
    return allComments.filter(c => c.is_hidden === true);
}

/**
 * Unhide all hidden comments on a post
 * @returns Object with success count and failed comments
 */
export async function unhideAllCommentsOnPost(
    postId: string,
    accessToken: string,
    pageId?: string // Optional: only unhide comments from this page
): Promise<{ unhidden: number; failed: number; errors: string[] }> {
    console.log(`[unhideAllCommentsOnPost] Starting for post ${postId}`);

    const hiddenComments = await getHiddenComments(postId, accessToken);
    console.log(`[unhideAllCommentsOnPost] Found ${hiddenComments.length} hidden comments`);

    let unhidden = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const comment of hiddenComments) {
        // If pageId is specified, only unhide comments from that page
        if (pageId && comment.from?.id !== pageId) {
            console.log(`[unhideAllCommentsOnPost] Skipping comment from other user: ${comment.from?.name}`);
            continue;
        }

        const result = await unhideComment(comment.id, accessToken);
        if (result.success) {
            unhidden++;
        } else {
            failed++;
            errors.push(`${comment.id}: ${result.error}`);
        }

        // Delay between unhides to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[unhideAllCommentsOnPost] Completed: ${unhidden} unhidden, ${failed} failed`);
    return { unhidden, failed, errors };
}

/**
 * Scan all posts and unhide all hidden comments from the page
 */
export async function unhideAllPageComments(
    pageId: string,
    accessToken: string,
    maxPosts: number = 50
): Promise<{
    postsScanned: number;
    totalUnhidden: number;
    totalFailed: number;
    postResults: { postId: string; unhidden: number; failed: number }[]
}> {
    console.log(`[unhideAllPageComments] Starting scan for page ${pageId}`);

    // Get all posts
    const posts = await getAllPosts(pageId, accessToken);
    const postsToScan = posts.slice(0, maxPosts);
    console.log(`[unhideAllPageComments] Scanning ${postsToScan.length} posts`);

    let totalUnhidden = 0;
    let totalFailed = 0;
    const postResults: { postId: string; unhidden: number; failed: number }[] = [];

    for (const post of postsToScan) {
        const result = await unhideAllCommentsOnPost(post.id, accessToken, pageId);

        if (result.unhidden > 0 || result.failed > 0) {
            postResults.push({
                postId: post.id,
                unhidden: result.unhidden,
                failed: result.failed
            });
        }

        totalUnhidden += result.unhidden;
        totalFailed += result.failed;

        // Delay between posts
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`[unhideAllPageComments] Completed: ${postsToScan.length} posts scanned, ${totalUnhidden} unhidden, ${totalFailed} failed`);

    return {
        postsScanned: postsToScan.length,
        totalUnhidden,
        totalFailed,
        postResults
    };
}
