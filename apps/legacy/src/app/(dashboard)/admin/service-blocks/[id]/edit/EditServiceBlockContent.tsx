'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../../../../convex/_generated/api';
import { Id } from '../../../../../../../convex/_generated/dataModel';
import { ServiceBlockForm } from '@/features/services/components/ServiceBlockForm';
import { Skeleton } from '@/components/ui/Skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/providers/ToastProvider';
import styles from './EditServiceBlockContent.module.css';

interface EditServiceBlockContentProps {
  id: string;
}

export function EditServiceBlockContent({ id }: EditServiceBlockContentProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const block = useQuery(api.serviceBlocks.getById, { id: id as Id<'serviceBlocks'> });
  const allServices = useQuery(api.services.list);
  const assignService = useMutation(api.serviceBlocks.assignService);
  const removeServiceFromBlock = useMutation(api.serviceBlocks.removeService);

  const [selectedServiceId, setSelectedServiceId] = useState<string>('');

  if (block === undefined) {
    return (
      <div style={{ maxWidth: '800px' }}>
        <Skeleton height={400} variant="rectangular" />
      </div>
    );
  }

  if (block === null) {
    router.push('/admin/service-blocks');
    return null;
  }

  const unassignedServices = allServices?.filter(
    (s) => !s.blockId || s.blockId === undefined
  ) || [];

  const handleAssign = async () => {
    if (!selectedServiceId) return;
    try {
      await assignService({
        blockId: block._id,
        serviceId: selectedServiceId as Id<'services'>,
      });
      success('Servicio asignado al bloque');
      setSelectedServiceId('');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al asignar');
    }
  };

  const handleRemoveService = async (serviceId: Id<'services'>) => {
    try {
      await removeServiceFromBlock({ serviceId });
      success('Servicio removido del bloque');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Error al remover');
    }
  };

  return (
    <div className={styles.wrapper}>
      <ServiceBlockForm
        mode="edit"
        initialData={{
          _id: block._id,
          title: block.title,
          subtitle: block.subtitle,
          imageStorageId: block.imageStorageId ?? undefined,
          isActive: block.isActive,
        }}
      />

      <div className={styles.assignmentSection}>
        <Card>
          <CardHeader
            title="Servicios asignados"
            description="Gestiona los servicios que pertenecen a este bloque"
          />
          <CardContent>
            {block.services.length > 0 ? (
              <ul className={styles.serviceList}>
                {block.services.map((service) => (
                  <li key={service._id} className={styles.serviceItem}>
                    <div className={styles.serviceInfo}>
                      <span className={`material-icons ${styles.serviceIcon}`}>
                        {service.iconName}
                      </span>
                      <span className={styles.serviceName}>{service.title}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveService(service._id)}
                    >
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.emptyMessage}>
                No hay servicios asignados a este bloque.
              </p>
            )}

            <div className={styles.assignRow}>
              <select
                className={styles.select}
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
              >
                <option value="">Seleccionar servicio...</option>
                {unassignedServices.map((service) => (
                  <option key={service._id} value={service._id}>
                    {service.title}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAssign}
                disabled={!selectedServiceId}
              >
                Asignar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
