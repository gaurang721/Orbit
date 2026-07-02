'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import type {
  CommentDTO,
  CreatePostInput,
  HashtagDTO,
  Paginated,
  PollDTO,
  PostDTO,
  ReactionSummary,
  ReactionType,
  SharePostInput,
  UpdatePostInput,
} from '@fbclone/types';
import { api } from '@/lib/api-client';

const FEED_KEY = ['feed'];
type FeedPage = Paginated<PostDTO>;
type FeedData = InfiniteData<FeedPage>;

/**
 * Apply an item-level transform to every cached post list — the main feed, any
 * page feed (`['page-posts', pageId]`) AND any group feed (`['group-posts', groupId]`)
 * — so reactions, comments, edits and deletes stay live wherever a post is shown.
 */
function patchAllFeeds(qc: ReturnType<typeof useQueryClient>, transform: (items: PostDTO[]) => PostDTO[]) {
  const apply = (data?: FeedData) =>
    data ? { ...data, pages: data.pages.map((p) => ({ ...p, items: transform(p.items) })) } : data;
  qc.setQueryData<FeedData>(FEED_KEY, apply);
  qc.setQueriesData<FeedData>({ queryKey: ['page-posts'] }, apply);
  qc.setQueriesData<FeedData>({ queryKey: ['group-posts'] }, apply);
}

export function useFeed() {
  return useInfiniteQuery({
    queryKey: FEED_KEY,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<FeedPage>(`/posts/feed?limit=10${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useScheduledPosts() {
  return useQuery({
    queryKey: ['scheduled-posts'],
    queryFn: () => api.get<{ posts: PostDTO[] }>('/posts/scheduled'),
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: ['post', id],
    queryFn: () => api.get<{ post: PostDTO }>(`/posts/${id}`),
    enabled: !!id,
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    // Accepts a plain input (text-only) or FormData (with image attachments).
    mutationFn: (input: CreatePostInput | FormData) => api.post<{ post: PostDTO }>('/posts', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: FEED_KEY }),
  });
}

export function useUpdatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, ...input }: { postId: string } & UpdatePostInput) =>
      api.patch<{ post: PostDTO }>(`/posts/${postId}`, input),
    onSuccess: ({ post }) => {
      // Replace the edited post wherever it's cached (feeds + permalink).
      patchAllFeeds(qc, (items) => items.map((x) => (x.id === post.id ? post : x)));
      qc.setQueryData<{ post: PostDTO }>(['post', post.id], (d) => (d ? { post } : d));
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/posts/${id}`),
    onSuccess: (_d, id) => {
      patchAllFeeds(qc, (items) => items.filter((x) => x.id !== id));
    },
  });
}

/** Patch a single post's reaction summary across all feeds and the permalink cache. */
function patchReactions(qc: ReturnType<typeof useQueryClient>, postId: string, reactions: ReactionSummary) {
  patchAllFeeds(qc, (items) => items.map((x) => (x.id === postId ? { ...x, reactions } : x)));
  qc.setQueryData<{ post: PostDTO }>(['post', postId], (d) => (d ? { post: { ...d.post, reactions } } : d));
}

export function useReactToPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, type }: { postId: string; type: ReactionType | null }) =>
      type === null
        ? api.delete<{ reactions: ReactionSummary }>(`/posts/${postId}/react`)
        : api.post<{ reactions: ReactionSummary }>(`/posts/${postId}/react`, { type }),
    onSuccess: (res, { postId }) => patchReactions(qc, postId, res.reactions),
  });
}

/** Patch a single post's poll across all feeds and the permalink cache. */
function patchPoll(qc: ReturnType<typeof useQueryClient>, postId: string, poll: PollDTO) {
  patchAllFeeds(qc, (items) => items.map((x) => (x.id === postId ? { ...x, poll } : x)));
  qc.setQueryData<{ post: PostDTO }>(['post', postId], (d) => (d ? { post: { ...d.post, poll } } : d));
}

export function useVotePoll() {
  const qc = useQueryClient();
  return useMutation({
    // optionIds is the viewer's full desired selection (empty array = clear).
    mutationFn: ({ postId, optionIds }: { postId: string; optionIds: string[] }) =>
      api.post<{ poll: PollDTO }>(`/posts/${postId}/vote`, { optionIds }),
    onSuccess: ({ poll }, { postId }) => patchPoll(qc, postId, poll),
  });
}

export function useSharePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, ...input }: { postId: string } & Partial<SharePostInput>) =>
      api.post<{ post: PostDTO }>(`/posts/${postId}/share`, input),
    onSuccess: ({ post }) => {
      // Bump the original post's share count wherever it's shown.
      const originalId = post.sharedPost?.id;
      if (originalId) {
        patchAllFeeds(qc, (items) =>
          items.map((x) => (x.id === originalId ? { ...x, shareCount: x.shareCount + 1 } : x)),
        );
        qc.setQueryData<{ post: PostDTO }>(['post', originalId], (d) =>
          d ? { post: { ...d.post, shareCount: d.post.shareCount + 1 } } : d,
        );
      }
      // Surface the new share at the top of the feed.
      qc.invalidateQueries({ queryKey: FEED_KEY });
    },
  });
}

export function useSavePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, save }: { postId: string; save: boolean }) =>
      api.post(`/posts/${postId}/${save ? 'save' : 'unsave'}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-posts'] }),
  });
}

export function useComments(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['comments', postId],
    queryFn: () => api.get<{ comments: CommentDTO[] }>(`/posts/${postId}/comments`),
    enabled,
  });
}

// ----- Hashtags --------------------------------------------------------------
export function useHashtagFeed(tag: string) {
  return useInfiniteQuery({
    queryKey: ['hashtag', tag],
    enabled: !!tag,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<FeedPage>(`/posts/hashtag/${encodeURIComponent(tag)}?limit=10${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useTrendingHashtags() {
  return useQuery({
    queryKey: ['trending-hashtags'],
    queryFn: () => api.get<{ hashtags: HashtagDTO[] }>('/posts/trending-hashtags'),
    staleTime: 60_000,
  });
}

// ----- Page posts (in-context page feed) -------------------------------------
export function usePagePosts(pageId: string) {
  return useInfiniteQuery({
    queryKey: ['page-posts', pageId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<FeedPage>(`/pages/${pageId}/posts?limit=10${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!pageId,
  });
}

export function useCreatePagePost(pageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput | FormData) =>
      api.post<{ post: PostDTO }>(`/pages/${pageId}/posts`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['page-posts', pageId] }),
  });
}

// ----- Group posts (in-context group feed) -----------------------------------
export function useGroupPosts(groupId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['group-posts', groupId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<FeedPage>(`/groups/${groupId}/posts?limit=10${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!groupId && enabled,
  });
}

export function useCreateGroupPost(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput | FormData) =>
      api.post<{ post: PostDTO }>(`/groups/${groupId}/posts`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['group-posts', groupId] }),
  });
}

export function useAddComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api.post<{ comment: CommentDTO }>(`/posts/${postId}/comments`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', postId] });
      // bump the comment count across all feeds…
      patchAllFeeds(qc, (items) =>
        items.map((x) => (x.id === postId ? { ...x, commentCount: x.commentCount + 1 } : x)),
      );
      // …and in the permalink cache, if the post is open there
      qc.setQueryData<{ post: PostDTO }>(['post', postId], (d) =>
        d ? { post: { ...d.post, commentCount: d.post.commentCount + 1 } } : d,
      );
    },
  });
}

/** Patch a single comment in the ['comments', postId] cache. */
function patchComment(
  qc: ReturnType<typeof useQueryClient>,
  postId: string,
  commentId: string,
  patch: Partial<CommentDTO>,
) {
  qc.setQueryData<{ comments: CommentDTO[] }>(['comments', postId], (d) =>
    d ? { comments: d.comments.map((c) => (c.id === commentId ? { ...c, ...patch } : c)) } : d,
  );
}

export function useReactToComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, type }: { commentId: string; type: ReactionType | null }) =>
      type === null
        ? api.delete<{ reactionCount: number; myReaction: ReactionType | null }>(`/posts/comments/${commentId}/react`)
        : api.post<{ reactionCount: number; myReaction: ReactionType | null }>(`/posts/comments/${commentId}/react`, { type }),
    onSuccess: (res, { commentId }) =>
      patchComment(qc, postId, commentId, { reactionCount: res.reactionCount, myReaction: res.myReaction }),
  });
}

export function useUpdateComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      api.patch<{ comment: CommentDTO }>(`/posts/comments/${commentId}`, { content }),
    onSuccess: ({ comment }) => patchComment(qc, postId, comment.id, comment),
  });
}

export function useDeleteComment(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.delete<{ ok: boolean }>(`/posts/comments/${commentId}`),
    onSuccess: (_res, commentId) => {
      qc.setQueryData<{ comments: CommentDTO[] }>(['comments', postId], (d) =>
        d ? { comments: d.comments.filter((c) => c.id !== commentId) } : d,
      );
      patchAllFeeds(qc, (items) =>
        items.map((x) => (x.id === postId ? { ...x, commentCount: Math.max(0, x.commentCount - 1) } : x)),
      );
      qc.setQueryData<{ post: PostDTO }>(['post', postId], (d) =>
        d ? { post: { ...d.post, commentCount: Math.max(0, d.post.commentCount - 1) } } : d,
      );
    },
  });
}
