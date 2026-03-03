import React, { useState, useEffect } from 'react';

export default function VersionFooter() {
  const [backendVersion, setBackendVersion] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setBackendVersion(data.version ?? '—'))
      .catch(() => setBackendVersion('—'));
  }, []);

  const frontendVersion = import.meta.env.VITE_VERSION ?? 'dev';
  const backend = backendVersion ?? '…';

  return (
    <footer className="version-footer">
      Frontend {frontendVersion} | Backend {backend}
    </footer>
  );
}
