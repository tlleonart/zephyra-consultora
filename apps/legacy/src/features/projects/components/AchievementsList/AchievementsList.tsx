'use client';

import { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import styles from './AchievementsList.module.css';

interface AchievementsListProps {
  achievements: string[];
  onChange: (achievements: string[]) => void;
}

export const AchievementsList = ({ achievements, onChange }: AchievementsListProps) => {
  const [newAchievement, setNewAchievement] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = () => {
    if (!newAchievement.trim()) return;
    onChange([...achievements, newAchievement.trim()]);
    setNewAchievement('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleDelete = (index: number) => {
    onChange(achievements.filter((_, i) => i !== index));
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(achievements[index]);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    if (!editValue.trim()) {
      handleDelete(editingIndex);
    } else {
      const updated = [...achievements];
      updated[editingIndex] = editValue.trim();
      onChange(updated);
    }
    setEditingIndex(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...achievements];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === achievements.length - 1) return;
    const updated = [...achievements];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  return (
    <div className={styles.container}>
      <div className={styles.list}>
        {achievements.length === 0 ? (
          <div className={styles.empty}>
            No hay logros agregados. Agrega el primer logro del proyecto.
          </div>
        ) : (
          achievements.map((achievement, index) => (
            <div key={index} className={styles.item}>
              {editingIndex === index ? (
                <div className={styles.editRow}>
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleEditKeyDown}
                    className={styles.editInput}
                    autoFocus
                  />
                  <div className={styles.editActions}>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className={styles.iconButton}
                      title="Guardar"
                    >
                      <span className="material-icons">check</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className={styles.iconButton}
                      title="Cancelar"
                    >
                      <span className="material-icons">close</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.orderButtons}>
                    <button
                      type="button"
                      onClick={() => handleMoveUp(index)}
                      className={styles.iconButton}
                      disabled={index === 0}
                      title="Mover arriba"
                    >
                      <span className="material-icons">keyboard_arrow_up</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(index)}
                      className={styles.iconButton}
                      disabled={index === achievements.length - 1}
                      title="Mover abajo"
                    >
                      <span className="material-icons">keyboard_arrow_down</span>
                    </button>
                  </div>
                  <span className={styles.number}>{index + 1}.</span>
                  <span className={styles.text}>{achievement}</span>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(index)}
                      className={styles.iconButton}
                      title="Editar"
                    >
                      <span className="material-icons">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(index)}
                      className={`${styles.iconButton} ${styles.deleteButton}`}
                      title="Eliminar"
                    >
                      <span className="material-icons">delete</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className={styles.addRow}>
        <Input
          value={newAchievement}
          onChange={(e) => setNewAchievement(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ej: Reducción del 30% en emisiones de CO2"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={handleAdd}
          disabled={!newAchievement.trim()}
        >
          Agregar
        </Button>
      </div>
    </div>
  );
};
