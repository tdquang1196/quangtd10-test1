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
 * Get all posts from a page
 */
export async function getAllPosts(pageId: string, accessToken: string): Promise<FBPost[]> {
    const allPosts: FBPost[] = [];
    let nextUrl: string | null = `${BASE_URL}/${pageId}/posts?fields=id,message,created_time&limit=25&access_token=${accessToken}`;

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
 * Get all videos/reels from a page
 */
export async function getAllVideos(pageId: string, accessToken: string): Promise<FBPost[]> {
    const allVideos: FBPost[] = [];
    let nextUrl: string | null = `${BASE_URL}/${pageId}/videos?fields=id,description,created_time&limit=25&access_token=${accessToken}`;

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
 * Get page's comments on a post
 */
export async function getPageCommentsOnPost(
    postId: string,
    pageId: string,
    accessToken: string
): Promise<string[]> {
    const comments: string[] = [];
    let nextUrl: string | null = `${BASE_URL}/${postId}/comments?fields=id,message,from&limit=100&access_token=${accessToken}`;

    while (nextUrl) {
        try {
            const response = await fetch(nextUrl);
            const data: PaginatedResponse<any> = await response.json();

            if ((data as any).error) {
                break;
            }

            const pageComments = data.data
                .filter((c: any) => c.from?.id === pageId)
                .map((c: any) => c.message);

            comments.push(...pageComments);
            nextUrl = data.paging?.next || null;
        } catch (error) {
            break;
        }
    }

    return comments;
}

/**
 * Post a comment
 */
export async function postComment(
    postId: string,
    message: string,
    accessToken: string
): Promise<string | null> {
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
            throw new Error(data.error.message);
        }

        return data.id;
    } catch (error) {
        console.error('Error posting comment:', error);
        return null;
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
