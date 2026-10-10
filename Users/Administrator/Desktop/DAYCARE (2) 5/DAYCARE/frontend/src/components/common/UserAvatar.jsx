import React, { useState, useEffect } from 'react';
import { getAvatarUrl } from '../../utils/avatar';

const SIZES = {
  xs: { box: 'w-7 h-7', text: 'text-xs', dot: 'w-2 h-2' },
  sm: { box: 'w-8 h-8', text: 'text-xs', dot: 'w-2 h-2' },
  md: { box: 'w-10 h-10', text: 'text-sm', dot: 'w-2.5 h-2.5' },
  lg: { box: 'w-11 h-11', text: 'text-base', dot: 'w-2.5 h-2.5' },
  xl: { box: 'w-20 h-20', text: 'text-2xl', dot: 'w-3.5 h-3.5' },
  '2xl': { box: 'w-28 h-28', text: 'text-3xl', dot: 'w-4 h-4' },
  '3xl': { box: 'w-32 h-32', text: 'text-4xl', dot: 'w-4 h-4' },
};

/**
 * Bulletproof UserAvatar component.
 * Gracefully displays the user's avatar image or falls back to a styled initial badge.
 * Guarantees no broken image icon or overlapping alt text is ever visible.
 */
const UserAvatar = ({
  user,
  avatar,
  name,
  size = 'md',
  showOnline = false,
  ring = true,
  className = '',
  imgClassName = '',
  textClassName = '',
  onClick,
}) => {
  const rawAvatar = avatar !== undefined ? avatar : user?.avatar;
  const avatarUrl = getAvatarUrl(rawAvatar);
  const [hasError, setHasError] = useState(false);

  // Reset error when avatar URL changes
  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  const displayName = name || user?.fullName || user?.name || user?.email || 'User';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'U';

  const sizeCfg = SIZES[size] || SIZES.md;
  const ringClass = ring
    ? (typeof ring === 'string' ? ring : 'ring-2 ring-white dark:ring-[#0A1218]')
    : '';

  const canShowImage = Boolean(avatarUrl) && !hasError;

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center flex-shrink-0 rounded-full select-none ${sizeCfg.box} ${ringClass} ${className}`}
    >
      {/* Fallback initial element — always present behind or shown when no image */}
      <div
        className={`w-full h-full rounded-full bg-gradient-to-tr from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold shadow-sm ${sizeCfg.text} ${textClassName}`}
      >
        {initial}
      </div>

      {/* Real image — layered on top; immediately hidden on load error */}
      {canShowImage && (
        <img
          src={avatarUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          onError={(e) => {
            setHasError(true);
            e.currentTarget.style.display = 'none';
          }}
          className={`absolute inset-0 w-full h-full rounded-full object-cover shadow-sm ${imgClassName}`}
        />
      )}

      {/* Optional online indicator badge */}
      {showOnline && (
        <span
          className={`absolute bottom-0 right-0 rounded-full bg-emerald-400 border-2 border-white dark:border-[#0A1218] ${sizeCfg.dot}`}
        />
      )}
    </div>
  );
};

export default UserAvatar;
