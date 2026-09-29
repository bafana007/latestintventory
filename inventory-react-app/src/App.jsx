import React, { useEffect, useState } from 'react';
import InventoryShell from './components/InventoryShell.jsx';
import { loadInventoryRuntime } from './services/legacyLoader.js';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadInventoryRuntime()
      .then(() => {
        window.StripeConfig = {
          publishableKey:
            import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
            'pk_test_51UINqXLnZRvzV2W3QKbZd2YKsb6wa2z2Q9NEaQLRYwAbdMuCJqGE2xuXtbZoX8pn6IYhI0W1mYo8KAhk6ynM05Nt001WUQc1hJ',
        };
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError(err.message || 'Inventory application failed to start.');
      });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <div className="react-loader"><div className="auth-card"><span className="brand">Inventory</span><p className="muted">{error}</p></div></div>;
  }

  return <><div className={!ready ? 'react-loader' : 'react-loader hidden'}><span className="brand">Inventory</span></div><InventoryShell /></>;
}
