'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './Table.module.css';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyMessage?: string;
}

export const Table = <T extends object>({
  columns,
  data,
  keyExtractor,
  sortKey,
  sortDirection,
  onSort,
  emptyMessage = 'No hay datos para mostrar',
}: TableProps<T>) => {
  const handleHeaderClick = (column: Column<T>) => {
    if (column.sortable && onSort) {
      onSort(column.key);
    }
  };

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  styles.header,
                  column.sortable && styles.sortable,
                  sortKey === column.key && styles.sorted
                )}
                style={{ width: column.width }}
                onClick={() => handleHeaderClick(column)}
              >
                <span className={styles.headerContent}>
                  {column.header}
                  {column.sortable && (
                    <span className={styles.sortIcon}>
                      {sortKey === column.key ? (
                        sortDirection === 'asc' ? '↑' : '↓'
                      ) : (
                        '↕'
                      )}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.emptyCell}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={keyExtractor(item)} className={styles.row}>
                {columns.map((column) => (
                  <td key={column.key} className={styles.cell}>
                    {column.render
                      ? column.render(item)
                      : String((item as Record<string, unknown>)[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
