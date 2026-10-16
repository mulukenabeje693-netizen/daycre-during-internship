import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/useLanguage';

const ChildSelectDropdown = ({ childrenList, selectedIds, onChange, label = 'Select Children' }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      onChange(childrenList.map(c => c._id));
    } else {
      onChange([]);
    }
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const allSelected = childrenList.length > 0 && selectedIds.length === childrenList.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < childrenList.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-slate-200 dark:border-teal-900/40 rounded-xl px-4 py-3 text-[13px] font-semibold bg-slate-50 dark:bg-[#0d1520] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-shadow flex items-center justify-between cursor-pointer"
      >
        <span className="truncate">
          {selectedIds.length === 0 
            ? (t('chooseChildDots') || label)
            : `${selectedIds.length} ${t('selected') || 'selected'}`}
        </span>
        <i className={`bx bx-chevron-down text-lg text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-[#111c2d] border border-slate-200 dark:border-teal-900/40 rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-x-hidden">
          {/* Header Row: Select All */}
          <div className="sticky top-0 z-10 bg-slate-50 dark:bg-[#0d1520] px-4 py-3 border-b border-slate-100 dark:border-teal-900/30 flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={allSelected}
              ref={input => {
                if (input) input.indeterminate = someSelected;
              }}
              onChange={handleSelectAll}
              className="w-4 h-4 text-teal-600 bg-slate-100 border-slate-300 rounded focus:ring-teal-500 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
            />
            <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 cursor-default">Select All</span>
          </div>
          
          {/* Options */}
          {childrenList.map((child) => {
            const isSelected = selectedIds.includes(child._id);
            const initial = child.firstName ? child.firstName.charAt(0).toUpperCase() : '';
            const roomName = child.classroom?.name || child.classroom?.room || (typeof child.classroom === 'string' ? child.classroom : 'Unassigned');
            
            return (
              <div 
                key={child._id}
                onClick={() => handleSelectOne(child._id)}
                className="px-4 py-2.5 border-b border-slate-50 dark:border-teal-900/10 hover:bg-slate-50 dark:hover:bg-[#162030] flex items-center gap-3 cursor-pointer transition-colors"
              >
                <input 
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}} 
                  className="w-4 h-4 text-teal-600 bg-slate-100 border-slate-300 rounded focus:ring-teal-500 dark:bg-slate-700 dark:border-slate-600 cursor-pointer flex-shrink-0"
                />
                
                <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-teal-600 font-bold text-xs">{initial}</span>
                </div>
                
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-semibold text-slate-800 dark:text-white truncate">
                    {child.firstName} {child.lastName}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    Room: {roomName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChildSelectDropdown;
