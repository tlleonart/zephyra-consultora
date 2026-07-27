'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { BlogForm } from '@/features/blog/components/BlogForm';
import { Skeleton } from '@/components/ui/Skeleton';

interface EditBlogPostContentProps {
  id: string;
}

export function EditBlogPostContent({ id }: EditBlogPostContentProps) {
  const router = useRouter();
  const post = useQuery(api.blogPosts.getById, { id: id as Id<'blogPosts'> });

  if (post === undefined) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
        <Skeleton height={600} variant="rectangular" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Skeleton height={200} variant="rectangular" />
          <Skeleton height={200} variant="rectangular" />
        </div>
      </div>
    );
  }

  if (post === null) {
    router.push('/admin/blog');
    return null;
  }

  return (
    <BlogForm
      mode="edit"
      initialData={{
        _id: post._id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        coverStorageId: post.coverStorageId,
        authorId: post.authorId,
        status: post.status,
        publishedAt: post.publishedAt,
      }}
    />
  );
}
