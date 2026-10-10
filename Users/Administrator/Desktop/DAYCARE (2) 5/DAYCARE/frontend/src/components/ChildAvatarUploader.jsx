import React, { useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import api from '../services/api';

/**
 * ChildAvatarUploader
 * Props:
 * - childId: id used for API upload
 * - name: child's full name (for initials fallback)
 * - src: current photo URL (optional)
 * - size: pixel size of the avatar (default 96)
 * - onUploaded: callback(updatedChild) optional
 */
const ChildAvatarUploader = ({ childId, name, src, size = 96, onUploaded }) => {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const initials = (fullName = '') => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const colorFromName = (s) => {
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 60% 50%)`;
  };

  const handleClick = () => inputRef.current?.click();

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    // Basic file type check
    if (!f.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Please select an image file (jpg, png, gif).' });
      return;
    }
    const url = URL.createObjectURL(f);
    setPreview(url);
    setFile(f);
    setMessage(null);
  };

  const handleCancel = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('avatar', file);

      const res = await api.put(`/children/${childId}/avatar`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage({ type: 'success', text: 'Photo updated successfully.' });
      setPreview(null);
      setFile(null);
      if (onUploaded && res.data?.data) onUploaded(res.data.data);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      const text = err.response?.data?.message || err.message || 'Upload failed';
      setMessage({ type: 'error', text });
    } finally {
      setUploading(false);
      setTimeout(() => setMessage(null), 3500);
    }
  };

  const displayUrl = preview || src || '';

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <div
        className="rounded-full overflow-hidden border-2 border-teal-600 bg-gray-100 flex items-center justify-center cursor-pointer shadow-sm"
        style={{ width: size, height: size }}
        onClick={handleClick}
        title="Change photo"
      >
        {displayUrl ? (
          <img src={displayUrl} alt={name || 'child'} className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white font-bold" style={{ background: colorFromName(name || 'Unknown') }}>
            <span style={{ fontSize: Math.round(size * 0.36) }}>{initials(name)}</span>
          </div>
        )}
      </div>

      {/* Hover overlay camera icon */}
      <div className="absolute inset-0 flex items-end justify-end p-1 opacity-0 hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={handleClick}
          className="bg-white/90 text-teal-700 rounded-full p-1 shadow-md hover:bg-white"
          title="Edit photo"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
            <path d="M7 10a4 4 0 0 1 8 0" />
            <path d="M14 3l7 7" />
          </svg>
        </button>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {/* Action buttons */}
      {preview && (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={uploading}
            className="bg-teal-600 text-white px-3 py-1 rounded-md text-sm disabled:opacity-60 flex items-center gap-2"
          >
            {uploading ? (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8v8z" fill="currentColor" className="opacity-75" />
              </svg>
            ) : null}
            Save
          </button>
          <button onClick={handleCancel} className="bg-white border border-gray-200 px-3 py-1 rounded-md text-sm">Cancel</button>
        </div>
      )}

      {/* Inline toast */}
      {message && (
        <div className={`mt-2 px-3 py-1 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

ChildAvatarUploader.propTypes = {
  childId: PropTypes.string.isRequired,
  name: PropTypes.string,
  src: PropTypes.string,
  size: PropTypes.number,
  onUploaded: PropTypes.func,
};

export default ChildAvatarUploader;
