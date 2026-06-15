'use client';

import { Plus } from 'lucide-react';
import {
  InlineReferenceList,
  InlineReferenceItem,
  InlineReferenceEmpty,
  InlineReferenceGroup,
  type InlineReferenceItemData,
} from './inline-reference';
import { getSkillBubbleStyle } from '../lib/skill-icons';
import { IMPECCABLE_ITEM_ID } from '../lib/impeccable-skill';
import { OPEN_SKILLS_CATALOG_EVENT } from '../lib/constants';

interface ImpeccableSkillPickerProps {
  impeccableSubMenuOpen: boolean;
  onBackFromSubMenu: () => void;
  isLoadingSkills?: boolean;
  showAddSkillButton?: boolean;
}

export function ImpeccableSkillPicker({
  impeccableSubMenuOpen,
  onBackFromSubMenu,
  isLoadingSkills = false,
  showAddSkillButton = true,
}: ImpeccableSkillPickerProps) {
  return (
    <InlineReferenceGroup heading={impeccableSubMenuOpen ? undefined : 'Skills'}>
      {impeccableSubMenuOpen && (
        <div className="flex items-center gap-1.5 px-2 pb-1 pt-0.5">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onBackFromSubMenu();
            }}
            className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium text-stone-400 hover:text-stone-600 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path d="M7 2L3 5l4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            back
          </button>
          <span className="text-[11px] font-semibold text-stone-500 tracking-wide uppercase">
            impeccable
          </span>
        </div>
      )}

      <InlineReferenceList className="max-h-[256px]">
        {(item) => <ImpeccableSkillPickerItem key={item.id} item={item} />}
      </InlineReferenceList>

      {!impeccableSubMenuOpen && (
        <>
          <InlineReferenceEmpty>
            {isLoadingSkills ? 'Loading skills…' : 'No skills available.'}
          </InlineReferenceEmpty>
          {showAddSkillButton && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                window.dispatchEvent(new CustomEvent(OPEN_SKILLS_CATALOG_EVENT));
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-stone-100 px-2 py-2 text-[12px] font-medium text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add a skill…
            </button>
          )}
        </>
      )}
    </InlineReferenceGroup>
  );
}

function ImpeccableSkillPickerItem({ item }: { item: InlineReferenceItemData }) {
  const isImpeccableParent = item.id === IMPECCABLE_ITEM_ID;
  const isCmd = item.id.startsWith(`${IMPECCABLE_ITEM_ID}:`);
  const cmdCategory = (item as InlineReferenceItemData & { impeccableCategory?: string }).impeccableCategory;

  if (isImpeccableParent) {
    return (
      <InlineReferenceItem
        value={item}
        className="gap-2.5 rounded-lg px-2 py-1.5 data-[selected=true]:bg-stone-100 data-[selected=true]:text-stone-900"
      >
        <span
          className="inline-flex items-center justify-center flex-shrink-0 rounded-full text-[10px] font-bold text-white"
          style={{
            width: 24,
            height: 24,
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
            boxShadow: '0 1px 3px rgba(124,58,237,0.35), inset 0 -2px 3px rgba(0,0,0,0.12), inset 0 2px 2px rgba(255,255,255,0.3)',
            flexShrink: 0,
          }}
        >
          i
        </span>
        <span className="flex-1 text-[13px] font-medium text-stone-800 truncate">
          {item.label}
        </span>
        <span className="ml-auto text-stone-400 text-[13px] leading-none">›</span>
      </InlineReferenceItem>
    );
  }

  if (isCmd) {
    const cmdId = item.id.slice(IMPECCABLE_ITEM_ID.length + 1);
    return (
      <InlineReferenceItem
        value={item}
        className="gap-2 rounded-lg px-2 py-1.5 data-[selected=true]:bg-stone-100 data-[selected=true]:text-stone-900"
      >
        {cmdCategory && (
          <span className="impeccable-cmd-category">{String(cmdCategory)}</span>
        )}
        <span className="text-[13px] font-medium text-stone-800">
          {cmdId}
        </span>
        {typeof item.description === 'string' && item.description && (
          <span className="ml-1 text-[11px] text-stone-400 truncate">
            {item.description}
          </span>
        )}
      </InlineReferenceItem>
    );
  }

  return (
    <InlineReferenceItem
      value={item}
      className="gap-2.5 rounded-lg px-2 py-1.5 data-[selected=true]:bg-stone-100 data-[selected=true]:text-stone-900"
    >
      <span style={getSkillBubbleStyle(item.id, 24)} />
      <span className="text-[13px] font-medium text-stone-800 truncate">
        {item.label}
      </span>
    </InlineReferenceItem>
  );
}
