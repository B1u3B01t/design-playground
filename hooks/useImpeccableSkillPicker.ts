'use client';

import { useState, useMemo, useCallback } from 'react';
import type { PlaygroundSkill } from '../skills';
import type { InlineReferenceItemData, OnSelectItemResult } from '../ui/inline-reference';
import {
  IMPECCABLE_ITEM_ID,
  IMPECCABLE_PARENT_ITEM,
  buildImpeccableCommandItems,
} from '../lib/impeccable-skill';

export interface ImpeccableDemoteState {
  pillEl: HTMLElement;
  position: { top: number; left: number };
}

export function useImpeccableSkillPicker(skills: PlaygroundSkill[]) {
  const [impeccableSubMenuOpen, setImpeccableSubMenuOpen] = useState(false);
  const [demoteState, setDemoteState] = useState<ImpeccableDemoteState | null>(null);

  const skillPickerItems = useMemo((): InlineReferenceItemData[] => {
    if (impeccableSubMenuOpen) {
      return buildImpeccableCommandItems('');
    }
    const regularItems = skills
      .filter((s) => s.id !== IMPECCABLE_ITEM_ID)
      .map((s) => ({
      id: s.id,
      label: s.label,
      description: s.description,
    }));
    return [IMPECCABLE_PARENT_ITEM, ...regularItems];
  }, [impeccableSubMenuOpen, skills]);

  const skillPickerFilterFn = useCallback(
    (item: InlineReferenceItemData, query: string): boolean => {
      if (impeccableSubMenuOpen) {
        const q = query.toLowerCase();
        const desc = typeof item.description === 'string' ? item.description : '';
        return !q || item.id.replace('impeccable:', '').includes(q) ||
          desc.toLowerCase().includes(q);
      }
      if (item.id === IMPECCABLE_ITEM_ID) return true;
      return item.label.toLowerCase().includes(query.toLowerCase());
    },
    [impeccableSubMenuOpen],
  );

  const handleSelectItem = useCallback(
    (trigger: string, item: InlineReferenceItemData): OnSelectItemResult => {
      if (trigger !== '/') return undefined;

      if (item.id === IMPECCABLE_ITEM_ID) {
        setImpeccableSubMenuOpen(true);
        return { preventDefault: true };
      }

      if (item.id.startsWith(`${IMPECCABLE_ITEM_ID}:`)) {
        const command = item.id.slice(IMPECCABLE_ITEM_ID.length + 1);
        setImpeccableSubMenuOpen(false);
        setDemoteState(null);
        return {
          overrideItem: {
            id: IMPECCABLE_ITEM_ID,
            label: `impeccable ${command}`,
            description: item.description,
            impeccableCommand: command,
          },
        };
      }

      return undefined;
    },
    [],
  );

  const handleImpeccableCommandCleared = useCallback(
    (pillEl: HTMLElement, containerEl: HTMLElement | null) => {
      if (!containerEl) return;
      const pillRect = pillEl.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();
      setImpeccableSubMenuOpen(true);
      setDemoteState({
        pillEl,
        position: {
          top: pillRect.bottom - containerRect.top + 4,
          left: pillRect.left - containerRect.left,
        },
      });
    },
    [],
  );

  const closeDemoteMenu = useCallback(() => {
    setDemoteState(null);
    setImpeccableSubMenuOpen(false);
  }, []);

  const resetImpeccablePicker = useCallback(() => {
    setImpeccableSubMenuOpen(false);
    setDemoteState(null);
  }, []);

  return {
    impeccableSubMenuOpen,
    setImpeccableSubMenuOpen,
    demoteState,
    setDemoteState,
    skillPickerItems,
    skillPickerFilterFn,
    handleSelectItem,
    handleImpeccableCommandCleared,
    closeDemoteMenu,
    resetImpeccablePicker,
  };
}
