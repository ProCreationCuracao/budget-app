import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Transactions from './Transactions';

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Handle auth session from URL (magic link)
    async function initAuth() {
      try {
        const { data: urlData, error: urlError } = await supabase.auth.getSessionFromUrl({ storeSession: true });
        if (urlError) console.error('Error parsing session from URL:', urlError.message);

        // Get current session
        const { data: sessData, error: sessError } = await supabase.auth.getSession();
        if (sessError) console.error('Error getting session:', sessError.message);

        // Prioritize session from URL, otherwise existing session
        setSession(urlData.session ?? sessData.session);
      } catch (error) {
        console.error('Auth initialization error:', error);
      }
    }

    initAuth();

    // Subscribe to auth state changes (e.g., sign out)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // If no session, show Auth UI
  if (!session) {
    return <Auth />;
  }

  // Once session exists, render transactions
  return <Transactions user={session.user} />;
}

function Auth() {
  const [email, setEmail] = useState('');

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      alert('Error sending link: ' + error.message);
    } else {
      alert('Magic link sent! Check your email.');
    }
  };

  return (
    <div style={{ maxWidth: 320, margin: '2rem auto', textAlign: 'center' }}>
      <h2>Log in / Sign up</h2>
      <input
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ width: '100%', padding: '.5rem' }}
      />
      <button onClick={signIn} style={{ marginTop: '1rem', padding: '.5rem 1rem' }}>
        Send Magic Link
      </button>
    </div>
  );
}
