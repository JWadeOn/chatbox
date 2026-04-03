'use client';

import { AuthForm } from '@/components/auth/AuthForm';
import { ChatApp } from '@/components/chat/ChatApp';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" label="Loading..." />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return <ChatApp />;
}
