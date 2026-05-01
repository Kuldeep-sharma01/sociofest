import React from 'react';
import { useSelector } from 'react-redux';
import Welcome from '@/components/ui/Welcome';
import HomeFeed from './HomeFeed';
import MainLayout from '@/layouts/MainLayout';

/**
 * LandingPage - Shows Welcome component for unauthenticated users,
 * and HomeFeed inside MainLayout for authenticated users
 */
export default function LandingPage() {
  const user = useSelector((state) => state.auth.user);

  // Show Welcome page for unauthenticated users
  if (!user) {
    
    return (
      <Welcome />
    );
  }

  // Show HomeFeed for authenticated users inside the site layout
  return (
      <HomeFeed />
  );
}
