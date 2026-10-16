import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../context/useLanguage';

/* ── tiny QR-code via Google Charts API (no extra dependency) */
const qrUrl = (text) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(text)}`;

/* ── barcode via barcodeapi.org */
const barcodeUrl = (text) =>
  `https://barcodeapi.org/api/128/${encodeURIComponent(text)}`;

/* ── expiry 1 year from now */
const expiryDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

/* ── generate student ID */
const makeStudentId = (child) =>
  `MINT-${String(child._id).slice(-6).toUpperCase()}`;

/* ════════════════════════════════════════════════
   FRONT of ID card
════════════════════════════════════════════════ */
const IDFront = ({ child, studentId }) => {
  const guardian = child.parents?.[0];
  const guardianName = guardian?.fullName || '—';
  const emergencyPhone = child.emergencyContact?.phone || '—';
  const classroom = child.classroom?.name || '—';

  return (
    <div
      id={`id-front-${child._id}`}
      style={{
        width: '340px', height: '520px',
        backgroundColor: '#f9f8ec', // pale cream
        borderRadius: '16px',
        border: '3px solid rgba(26,92,42,0.1)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        flexShrink: 0,
        backgroundImage: 'url(/assets/optimized/daycare-bg-front.webp)',
        backgroundPosition: 'bottom center',
        backgroundSize: '100% auto',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* top white fade overlay */}
      <div style={{
        position:'absolute', inset:0,
        background: 'linear-gradient(to bottom, #f9f8ec 0%, #f9f8ec 45%, rgba(249,248,236,0.85) 60%, transparent 100%)',
        zIndex: 1
      }} />

      <div style={{ position:'relative', zIndex:2, display:'flex', flexDirection:'column', height:'100%' }}>
        
        {/* Top bar: Logo + Allergy */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'16px 20px 0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <img src="/assets/optimized/mint-logo.webp" alt="MinT" style={{ width:42, height:42, objectFit:'contain' }} />
            <div style={{ lineHeight:1.1 }}>
              <div style={{ fontSize:'22px', fontWeight:900, color:'#1a5c2a', letterSpacing:'-0.5px' }}>MinT</div>
              <div style={{ fontSize:'10px', fontWeight:800, letterSpacing:'1px', color:'#d4af37' }}>DAYCARE</div>
              <div style={{ fontSize:'7px', color:'#555', fontWeight:600 }}>Nurture • Play • Grow</div>
            </div>
          </div>
        </div>

        {/* Main Content Section */}
        <div style={{ display:'flex', gap:'16px', padding:'16px 20px 0' }}>
          
          {/* Left: Photo */}
          <div style={{ width:'90px', flexShrink:0 }}>
            <div style={{
              width:'90px', height:'90px', borderRadius:'50%', border:'3px solid #1a5c2a',
              backgroundColor:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'18px', color:'#1a5c2a', fontWeight:800,
              boxShadow:'0 4px 12px rgba(26,92,42,0.15)'
            }}>
              PHOTO
            </div>
          </div>
          
          {/* Center: Details */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'14px' }}>
            {/* Child Details */}
            <div>
               <div style={{ display:'inline-block', backgroundColor:'#1a5c2a', color:'#fff', padding:'3px 10px', borderRadius:'12px', fontSize:'9px', fontWeight:800, marginBottom:'8px' }}>
                 👤 CHILD DETAILS
               </div>
              <div style={{ fontSize:'9px', color:'#111', fontWeight:600, display:'flex', flexDirection:'column', gap:'5px' }}>
                {[
                  ['Full Name', `${child.firstName} ${child.lastName}`],
                  ['Student ID', studentId],
                  ['Class', classroom],
                  ['Age', child.age ? `${child.age} yrs` : '—'],
                  ['Blood Type', child.bloodType || '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display:'flex', alignItems:'flex-end' }}>
                    <span style={{ width:'60px', color:'#444', display:'flex', alignItems:'center', gap:'4px' }}>
                      {label}
                    </span>
                    <span style={{ color:'#888', margin:'0 4px' }}>:</span>
                    <span style={{ borderBottom:'1px dotted #888', flex:1, paddingBottom:'1px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Guardian Details */}
            <div>
               <div style={{ display:'inline-block', backgroundColor:'#1a5c2a', color:'#fff', padding:'3px 10px', borderRadius:'12px', fontSize:'9px', fontWeight:800, marginBottom:'8px' }}>
                  👪 PARENT DETAILS
                </div>
                <div style={{ fontSize:'9px', color:'#111', fontWeight:600, display:'flex', flexDirection:'column', gap:'5px' }}>
                  {[
                    ['Guardian', guardianName],
                    ['Phone', emergencyPhone],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display:'flex', alignItems:'flex-end' }}>
                      <span style={{ width:'55px', color:'#444', display:'flex', alignItems:'center', gap:'4px' }}>{label}</span>
                      <span style={{ color:'#888', margin:'0 4px' }}>:</span>
                      <span style={{ borderBottom:'1px dotted #888', flex:1, paddingBottom:'1px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{val}</span>
                    </div>
                  ))}
                </div>
            </div>
          </div>

          {/* Right: QR & Barcode */}
          <div style={{ width:'64px', display:'flex', flexDirection:'column', gap:'6px', flexShrink:0 }}>
            {/* QR Box */}
            <div style={{ 
              padding:'4px', border:'1px solid rgba(26,92,42,0.3)', borderRadius:'8px', 
              backgroundColor:'#f9f8ec', display:'flex', alignItems:'center', justifyContent:'center' 
            }}>
              <img src={qrUrl(`${studentId}|${child.firstName} ${child.lastName}`)} alt="QR" style={{ width: 54, height: 54, display:'block' }} />
            </div>
            {/* Barcode Box */}
            <div style={{ 
              padding:'4px', border:'1px solid rgba(0,0,0,0.15)', borderRadius:'6px', 
              backgroundColor:'#fff', display:'flex', alignItems:'center', justifyContent:'center' 
            }}>
              <img src={barcodeUrl(studentId)} alt="barcode" style={{ height: 26, width: '100%', objectFit:'fill', display:'block' }} />
            </div>
          </div>
          
        </div>
        
        {/* Bottom spacer to push footer down */}
        <div style={{ flex:1 }} />

        {/* Footer Info */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', padding:'0 20px 45px' }}>
          <div style={{ fontSize:'7.5px', color:'#fff', fontWeight:700, textShadow:'0 1px 3px rgba(0,0,0,0.8)' }}>
            <div style={{ display:'inline-block', backgroundColor:'#1a5c2a', color:'#fff', padding:'3px 8px', borderRadius:'10px', marginBottom:'4px', textShadow:'none', border:'1px solid rgba(255,255,255,0.2)' }}>
              🏫 DAYCARE INFO
            </div>
            <div style={{ color:'#fff' }}>Valid Thru / Expiry Date : {expiryDate()}</div>
          </div>
          
          <div style={{ fontSize:'7.5px', color:'#fff', fontWeight:700, textAlign:'right', textShadow:'0 1px 3px rgba(0,0,0,0.8)' }}>
            <div style={{ display:'inline-block', backgroundColor:'#1a5c2a', color:'#fff', padding:'3px 8px', borderRadius:'10px', marginBottom:'4px', textShadow:'none', border:'1px solid rgba(255,255,255,0.2)' }}>
              ✅ SECURITY & TECH
            </div>
            <div style={{ color:'#fff' }}>Scan for Attendance / Check-in</div>
          </div>
        </div>

        {/* Thank You Text */}
        <div style={{ position:'absolute', bottom:'15px', left:0, right:0, textAlign:'center', textShadow:'0 1px 4px rgba(0,0,0,0.9)' }}>
          <div style={{ fontSize:'16px', fontFamily:'cursive', color:'#fff' }}>Thank you ♡</div>
          <div style={{ fontSize:'9px', color:'#f5f5f5', fontWeight:600 }}>for being part of our MinT family.</div>
        </div>
        
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════
   BACK of ID card
════════════════════════════════════════════════ */
const IDBack = ({ child }) => (
  <div
    id={`id-back-${child._id}`}
    style={{
      width:'340px', height:'520px',
      backgroundColor:'#f9f8ec',
      borderRadius:'16px',
      border:'3px solid rgba(26,92,42,0.1)',
      fontFamily:'system-ui, -apple-system, sans-serif',
      position:'relative',
      overflow:'hidden',
      boxShadow:'0 8px 32px rgba(0,0,0,0.15)',
      flexShrink:0,
      backgroundImage: 'url(/assets/optimized/daycare-bg-back.webp)',
      backgroundPosition: 'bottom center',
      backgroundSize: '100% auto',
      backgroundRepeat: 'no-repeat',
    }}
  >
    {/* top white fade overlay */}
    <div style={{
      position:'absolute', inset:0,
      background: 'linear-gradient(to bottom, #f9f8ec 0%, #f9f8ec 45%, rgba(249,248,236,0.8) 60%, transparent 100%)',
      zIndex: 1
    }} />
    
    <div style={{ position:'relative', zIndex:2, display:'flex', flexDirection:'column', height:'100%' }}>
      {/* top green bar */}
      <div style={{
        margin:'12px 16px 0', height:'32px',
        backgroundColor:'#1a5c2a',
        borderRadius:'16px',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <span style={{ color:'#fff', fontSize:'10px', fontWeight:900, letterSpacing:'1px' }}>
          IF FOUND, PLEASE RETURN THIS ID CARD
        </span>
      </div>

      {/* return message */}
      <div style={{ padding:'20px 24px 0', textAlign:'center' }}>
        <p style={{ fontSize:'10px', color:'#444', lineHeight:1.5, fontWeight:600 }}>
          If you find this ID card, please contact us<br/>using the information below.
        </p>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', gap:'6px', marginTop:'12px' }}>
          <span style={{ fontSize:'12px' }}>📞</span>
          <span style={{ color:'#888' }}>:</span>
          <span style={{ borderBottom:'1px dotted #888', width:'160px' }} />
        </div>
      </div>

      {/* daycare info & logo row */}
      <div style={{ padding:'20px 16px 0', display:'flex', gap:'12px' }}>
        {/* Left: Logo */}
        <div style={{ width:'80px', display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', marginTop:'8px' }}>
          <img src="/assets/optimized/mint-logo.webp" alt="MinT" style={{ width:46, height:46, objectFit:'contain' }} />
          <div style={{ lineHeight:1.1, textAlign:'center' }}>
            <div style={{ fontSize:'18px', fontWeight:900, color:'#1a5c2a', letterSpacing:'-0.5px' }}>MinT</div>
            <div style={{ fontSize:'8px', fontWeight:800, letterSpacing:'1px', color:'#d4af37' }}>DAYCARE</div>
            <div style={{ fontSize:'5px', color:'#555', fontWeight:600 }}>Nurture • Play • Grow</div>
          </div>
        </div>

        {/* Right: Info */}
        <div style={{ flex:1 }}>
          <div style={{ display:'inline-block', backgroundColor:'#1a5c2a', color:'#fff', padding:'3px 10px', borderRadius:'12px', fontSize:'9px', fontWeight:800, marginBottom:'10px' }}>
            🏫 DAYCARE INFORMATION
          </div>
          <div style={{ fontSize:'9px', color:'#111', fontWeight:600, display:'flex', flexDirection:'column', gap:'6px' }}>
            {[
              ['Daycare Name', 'MinT Daycare'],
              ['Address',      'Addis Ababa, Ethiopia'],
              ['Phone',        '+251 900 000 000'],
              ['Email',        'info@mintdaycare.edu.et'],
            ].map(([label, val]) => (
              <div key={label} style={{ display:'flex', alignItems:'flex-end' }}>
                <span style={{ width:'75px', color:'#444', display:'flex', alignItems:'center', gap:'4px' }}>{label}</span>
                <span style={{ color:'#888', margin:'0 4px' }}>:</span>
                <span style={{ borderBottom:'1px dotted #888', flex:1, paddingBottom:'1px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Important Notes */}
      <div style={{ padding:'16px 16px 0', display:'flex', justifyContent:'flex-end' }}>
        <div style={{
          width:'140px', padding:'10px', backgroundColor:'#fff',
          borderRadius:'12px', border:'2px solid rgba(26,92,42,0.15)',
          fontSize:'8px', color:'#444', lineHeight:1.6, fontWeight:600,
          boxShadow:'0 4px 12px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontWeight:800, fontSize:'9px', marginBottom:'6px', color:'#1a5c2a' }}>IMPORTANT NOTES</div>
          <div>• This ID card is for daycare use only.</div>
          <div style={{ marginTop:4 }}>• Please bring this card daily.</div>
          <div style={{ marginTop:4 }}>• Report any loss immediately.</div>
        </div>
      </div>

      <div style={{ flex:1 }} />

      {/* bottom green bar */}
      <div style={{
        backgroundColor:'#1a5c2a',
        padding:'12px 16px',
        textAlign:'center', fontSize:'8.5px', color:'rgba(255,255,255,0.95)',
      }}>
        Thank you for helping us keep our children safe.<br/>
        <span style={{ fontWeight:800, color:'#d4af37' }}>Together, we nurture, play and grow. 💛</span>
      </div>
    </div>
  </div>
);

/* ════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════ */
const ChildIDGenerate = () => {
  const { t } = useLanguage();
  const [children, setChildren]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null); // child being previewed
  const [error, setError]         = useState('');

  useEffect(() => {
    api.get('/children')
      .then(res => setChildren(res.data.data))
      .catch(() => setError('Failed to load children.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = children.filter(c => {
    const name = `${c.firstName} ${c.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const handlePrint = (child) => {
    const studentId = makeStudentId(child);
    const win = window.open('', '_blank', 'width=800,height=700');
    win.document.write(`
      <html><head><title>MinT Daycare ID – ${child.firstName} ${child.lastName}</title>
      <style>
        body { margin:0; background:#e8e8e8; display:flex; flex-direction:column; align-items:center; padding:24px; gap:24px; font-family:Georgia,serif; }
        @media print { body { background:#fff; } @page { size:A4; margin:10mm; } }
        h3 { color:#1a5c2a; margin:0 0 4px; }
        .pair { display:flex; gap:20px; justify-content:center; flex-wrap:wrap; }
      </style></head><body>
      <h3>MinT Daycare — Child ID Card</h3>
      <p style="font-size:11px;color:#666;margin:0 0 12px;">Student: <b>ETB {child.firstName} ${child.lastName}</b> &nbsp;|&nbsp; ID: <b>ETB {studentId}</b></p>
      <div class="pair">
        ${document.getElementById(`id-front-${child._id}`)?.outerHTML || ''}
        ${document.getElementById(`id-back-${child._id}`)?.outerHTML || ''}
      </div>
      <script>window.onload=()=>{ window.print(); }<\/script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-6">
      {/* header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('childIdGenerateTitle')}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          {t('childIdGenerateSubtitle')}
        </p>
      </div>

      {error && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl p-4 text-sm">{error}</div>}

      {/* search */}
      <div className="relative max-w-md">
        <i className="bx bx-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder={t('searchChildByName')}
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-teal-900/40 rounded-xl text-sm bg-white dark:bg-[#111c2d] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(child => {
            const studentId = makeStudentId(child);
            const isSelected = selected?._id === child._id;
            return (
              <div key={child._id}
                onClick={() => setSelected(isSelected ? null : child)}
                className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                  isSelected
                    ? 'border-emerald-400 bg-emerald-500/5 shadow-lg'
                    : 'border-slate-200 dark:border-teal-900/30 bg-white dark:bg-[#111c2d] hover:border-emerald-400/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {child.firstName?.charAt(0) || '?'}{child.lastName?.charAt(0) || ''}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 dark:text-white text-sm">{child.firstName} {child.lastName}</p>
                    <p className="text-xs text-slate-400">{studentId}</p>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <div><span className="font-medium">{t('classroom')}:</span> {child.classroom?.name || t('unassigned')}</div>
                  <div><span className="font-medium">Age:</span> {child.age != null ? `${child.age} yrs` : 'N/A'}</div>
                  {child.allergies && <div className="text-rose-400">⚠ {child.allergies}</div>}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setSelected(child); handlePrint(child); }}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold py-2 rounded-xl transition-colors"
                >
                  <i className="bx bx-printer" /> {t('printIdCard')}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview — hidden render used by print */}
      {filtered.map(child => (
        <div key={child._id} style={{ position:'absolute', left:'-9999px', top:0, display:'flex', gap:16 }}>
          <IDFront child={child} studentId={makeStudentId(child)} />
          <IDBack  child={child} />
        </div>
      ))}

      {/* Preview modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#111c2d] rounded-2xl shadow-2xl p-6 w-full max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 dark:text-white text-lg">
                {t('idCardPreview')} — {selected.firstName} {selected.lastName}
              </h3>
              <button onClick={() => setSelected(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <i className="bx bx-x text-xl" />
              </button>
            </div>

            <div className="flex flex-wrap gap-5 justify-center">
              <IDFront child={selected} studentId={makeStudentId(selected)} />
              <IDBack  child={selected} />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setSelected(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0d1520] rounded-xl hover:bg-slate-200 transition-colors">
                {t('closeBtn')}
              </button>
              <button onClick={() => handlePrint(selected)}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors">
                <i className="bx bx-printer" /> {t('printIdCard')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChildIDGenerate;
