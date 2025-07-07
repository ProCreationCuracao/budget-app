import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Transactions from './Transactions';

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    setSession(supabase.auth.session());
    supabase.auth.onAuthStateChange((_, s) => setSession(s));
  }, []);

  if (!session) {
    return <Auth />;
  }
  return <Transactions user={session.user} />;
}

function Auth() {
  const [email, setEmail] = useState('');
  const signIn = () => {
    supabase.auth.signIn({ email }).then(() =>
      alert('Check your email for the login link!')
    );
  };

  return (
    <div style={{maxWidth:320, margin:'2rem auto'}}>
      <h2>Log in / Sign up</h2>
      <input
        style={{width:'100%', padding:'.5rem'}}
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />
      <button onClick={signIn} style={{marginTop:'1rem'}}>Send Magic Link</button>
    </div>
  );
}
