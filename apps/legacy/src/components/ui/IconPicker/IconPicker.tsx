'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './IconPicker.module.css';

// Common Material Icons relevant for services
const ICONS = [
  // Business & Finance
  'business',
  'business_center',
  'account_balance',
  'trending_up',
  'insights',
  'analytics',
  'assessment',
  'leaderboard',
  // Sustainability & Environment
  'eco',
  'nature',
  'park',
  'forest',
  'energy_savings_leaf',
  'recycling',
  'compost',
  'water_drop',
  // People & Teams
  'groups',
  'diversity_3',
  'handshake',
  'support_agent',
  'engineering',
  'people',
  'person',
  'school',
  // Innovation & Technology
  'lightbulb',
  'psychology',
  'hub',
  'settings',
  'build',
  'architecture',
  'code',
  'terminal',
  // Communication
  'campaign',
  'forum',
  'chat',
  'record_voice_over',
  'announcement',
  'message',
  'email',
  'contact_mail',
  // Legal & Compliance
  'gavel',
  'policy',
  'verified',
  'fact_check',
  'rule',
  'workspace_premium',
  'military_tech',
  'security',
  // Strategy & Planning
  'timeline',
  'route',
  'map',
  'explore',
  'flag',
  'star',
  'favorite',
  'bookmark',
  // Reports & Documents
  'description',
  'article',
  'summarize',
  'assignment',
  'folder',
  'inventory_2',
  'library_books',
  'menu_book',
];

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  label?: string;
  error?: string;
}

export const IconPicker = ({ value, onChange, label, error }: IconPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredIcons = ICONS.filter((icon) =>
    icon.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (iconName: string) => {
    onChange(iconName);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={styles.container} ref={containerRef}>
      {label && <label className={styles.label}>{label}</label>}

      <button
        type="button"
        className={`${styles.trigger} ${error ? styles.triggerError : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`material-icons ${styles.selectedIcon}`}>
          {value || 'help_outline'}
        </span>
        <span className={styles.selectedName}>
          {value || 'Selecciona un icono'}
        </span>
        <span className={`material-icons ${styles.chevron}`}>
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {error && <span className={styles.error}>{error}</span>}

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.searchContainer}>
            <span className={`material-icons ${styles.searchIcon}`}>search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
              placeholder="Buscar icono..."
              autoFocus
            />
          </div>

          <div className={styles.iconGrid}>
            {filteredIcons.length === 0 ? (
              <div className={styles.noResults}>No se encontraron iconos</div>
            ) : (
              filteredIcons.map((iconName) => (
                <button
                  key={iconName}
                  type="button"
                  className={`${styles.iconOption} ${value === iconName ? styles.selected : ''}`}
                  onClick={() => handleSelect(iconName)}
                  title={iconName}
                >
                  <span className="material-icons">{iconName}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
