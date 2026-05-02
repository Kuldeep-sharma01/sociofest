import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Welcome from '@/components/ui/Welcome';
import HomeFeed from './HomeFeed';
import MainLayout from '@/layouts/MainLayout';

/**
 * LandingPage - Shows Welcome component for unauthenticated users,
 * and HomeFeed inside MainLayout for authenticated users
 */
export default function LandingPage() {
  const user = useSelector((state) => state.auth.user);
  const navigate = useNavigate();

  // Redirect authenticated users to the Home Feed so they get the MainLayout
  React.useEffect(() => {
    if (user) {
      navigate('/home', { replace: true });
    }
  }, [user, navigate]);

  // Show Welcome page for unauthenticated users
  if (!user) {
    return <Welcome />;
  }

  // Fallback (redirecting...)
  return null;
}
