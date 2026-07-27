'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { Button } from '@/components/ui/Button';
import { useState } from 'react';

export const ExportButton = () => {
  const activeSubscribers = useQuery(api.newsletter.exportActiveEmails);
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (!activeSubscribers) return;

    setExporting(true);

    try {
      // Create CSV content
      const headers = ['Email', 'Fecha de suscripción'];
      const rows = activeSubscribers.map((sub) => [
        sub.email,
        new Date(sub.subscribedAt).toLocaleDateString('es-AR'),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.join(',')),
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `suscriptores-newsletter-${new Date().toISOString().split('T')[0]}.csv`
      );
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={handleExport}
      disabled={!activeSubscribers || activeSubscribers.length === 0}
      loading={exporting}
    >
      <span className="material-icons" style={{ fontSize: '18px', marginRight: '6px' }}>
        download
      </span>
      Exportar activos ({activeSubscribers?.length || 0})
    </Button>
  );
};
