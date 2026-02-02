'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { cn } from '@/lib/cn';
import { Button } from '../Button';
import styles from './ImageUpload.module.css';

export interface ImageUploadProps {
  value?: Id<'_storage'> | null;
  onChange: (storageId: Id<'_storage'> | null) => void;
  label?: string;
  error?: string;
  maxSizeMB?: number;
  accept?: string;
}

export const ImageUpload = ({
  value,
  onChange,
  label,
  error,
  maxSizeMB = 5,
  accept = 'image/jpeg,image/png,image/webp',
}: ImageUploadProps) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    const maxSize = maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError(`El archivo excede el tamaño máximo de ${maxSizeMB}MB`);
      return;
    }

    // Validate file type
    if (!accept.split(',').some((type) => file.type === type.trim())) {
      setUploadError('Formato de archivo no soportado');
      return;
    }

    setUploadError(null);
    setUploading(true);

    try {
      // Create local preview
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Upload file
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error('Error al subir el archivo');
      }

      const { storageId } = await response.json();
      onChange(storageId as Id<'_storage'>);
    } catch (err) {
      setUploadError('Error al subir la imagen. Intenta de nuevo.');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setPreview(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const displayError = error || uploadError;

  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}

      <div className={cn(styles.dropzone, displayError && styles.hasError)}>
        {(preview || value) ? (
          <div className={styles.previewContainer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview || `/api/storage/${value}`}
              alt="Preview"
              className={styles.preview}
            />
            <div className={styles.overlay}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClick}
                disabled={uploading}
              >
                Cambiar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRemove}
                disabled={uploading}
              >
                Eliminar
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.placeholder} onClick={handleClick}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={styles.icon}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p className={styles.placeholderText}>
              {uploading ? 'Subiendo...' : 'Haz clic para subir una imagen'}
            </p>
            <p className={styles.placeholderHint}>
              JPG, PNG o WebP. Máximo {maxSizeMB}MB.
            </p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className={styles.hiddenInput}
      />

      {displayError && <span className={styles.error}>{displayError}</span>}
    </div>
  );
};
