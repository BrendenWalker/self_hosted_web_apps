import React, { useEffect, useState } from 'react';

export default function VersionFooter() {
  const [backendVersion, setBackendVersion] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setBackendVersion(data.version ?? '—'))
      .catch(() => setBackendVersion('—'));
  }, []);

  const fe = import.meta.env.VITE_VERSION ?? 'dev';

  return (
    <footer className="version-footer">
      Frontend {fe} | Backend {backendVersion ?? '…'}
    </footer>
  );
}
