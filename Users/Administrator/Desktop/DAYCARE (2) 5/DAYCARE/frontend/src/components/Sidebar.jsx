import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import { useLanguage } from '../context/useLanguage';
import {
  LayoutDashboard,
  UserCheck,
  ClipboardCheck,
  Baby,
  Users,
  ShieldCheck,
  CalendarCheck,
  CreditCard,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserCog,
  UserPlus,
  MessageSquare,
  FileText,
  Utensils,
  Sparkles,
  Moon,
  Syringe,
  Video,
  DoorOpen,
  GraduationCap,
  Gauge,
  FileEdit,
  IdCard,
  ListTodo,
  ListChecks,
  ChefHat,
  Apple,
  Bus,
  MapPin,
} from 'lucide-react';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { collapsed, mobileOpen, toggle, setMobileOpen } = useSidebar();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!user) return null;

  const isCollapsed = !isMobile && collapsed;
  const translateX = isMobile && !mobileOpen ? '-100%' : '0';

  const handleNavClick = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const toggleSubmenu = (menuTitle) => {
    if (isCollapsed) return;
    setOpenMenu((prev) => (prev === menuTitle ? null : menuTitle));
  };

  const getPortalLabel = (role) => {
    switch (role) {
      case 'admin': return t('adminPortal');
      case 'parent': return t('parentPortal');
      case 'teacher': return t('teacherPortal');
      case 'reception': return t('receptionPortal');
      case 'staff': return t('staffPortal');
      default: return t('daycare');
    }
  };

  const portalLabel = getPortalLabel(user.role);

  const navigationConfig = [
    { titleKey: 'dashboard', icon: LayoutDashboard, path: `/dashboard/${user.role}`, roles: ['admin', 'parent', 'teacher', 'reception', 'staff'] },
    { titleKey: 'children', icon: Baby, path: `/dashboard/${user.role}/view-child`, roles: ['admin'] },
    { titleKey: 'parents', icon: ShieldCheck, path: `/dashboard/${user.role}/view-parent`, roles: ['admin'] },
    { titleKey: 'enrollmentApprovals', icon: ClipboardCheck, path: '/dashboard/admin/approvals', roles: ['admin'] },
    { titleKey: 'staffManagement', icon: UserCog, roles: ['admin'], subItems: [
      { labelKey: 'addStaff', icon: UserPlus, path: `/dashboard/admin/add-staff` },
      { labelKey: 'viewStaff', icon: Users, path: `/dashboard/admin/view-staff` },
      { labelKey: 'assign', icon: UserCheck, path: `/dashboard/admin/assign` }
    ]},
    { titleKey: 'classroom', icon: Users, roles: ['teacher'], subItems: [
      { labelKey: 'assignedRoom', icon: DoorOpen },
      { labelKey: 'studentList', icon: GraduationCap },
      { labelKey: 'capacity', icon: Gauge }
    ]},
    { titleKey: 'attendance', icon: CalendarCheck, roles: ['admin'], subItems: [
      { labelKey: 'childAttendance', icon: Baby, path: '/dashboard/admin/attendance' },
      { labelKey: 'childcareProviderAttendance', icon: UserCheck, path: '/dashboard/admin/teacher-attendance' }
    ]},
    { titleKey: 'attendance', icon: CalendarCheck, path: `/dashboard/${user.role}/attendance`, roles: ['teacher'] },
    { titleKey: 'myChildren', icon: Baby, roles: ['parent'], subItems: [
      { labelKey: 'registerChild', icon: UserPlus, path: '/dashboard/parent/register-child' },
      { labelKey: 'childProfile', icon: Baby, path: '/dashboard/parent/profile-card' },
    ]},
    { titleKey: 'registrationUpdates', icon: ClipboardCheck, path: '/dashboard/parent/registration-updates', roles: ['parent'] },
    { titleKey: 'payments', icon: CreditCard, path: `/dashboard/${user.role}/payments`, roles: ['parent', 'staff', 'admin'] },
    { titleKey: 'dailyReports', icon: FileText, path: `/dashboard/${user.role}/daily-reports`, roles: ['teacher', 'parent'], subItems: [
      { labelKey: 'mealsIntake', icon: Utensils },
      { labelKey: 'activitiesLog', icon: Sparkles },
      { labelKey: 'sleepNaps', icon: Moon },
      { labelKey: 'vaccinationLog', icon: Syringe }
    ]},
    { titleKey: 'registration', icon: UserCheck, roles: ['reception'], subItems: [
      { labelKey: 'newRegister', icon: UserPlus, path: '/dashboard/reception/new-child-registry' },
      { labelKey: 'updateInfo', icon: FileEdit, path: '/dashboard/reception/update-info' },
      { labelKey: 'childIdGenerate', icon: IdCard, path: '/dashboard/reception/child-id-generate' }
    ]},
    { titleKey: 'attendance', icon: CalendarCheck, roles: ['reception'], subItems: [
      { labelKey: 'childAttendance',    icon: Baby,      path: '/dashboard/reception/child-attendance'   },
      { labelKey: 'providerAttendance', icon: UserCheck, path: '/dashboard/reception/teacher-attendance' }
    ]},,    { titleKey: 'registrationUpdates', icon: ClipboardCheck, path: '/dashboard/reception/registration-updates', roles: ['reception'] },
    { titleKey: 'assignedDuties', icon: ClipboardCheck, roles: ['staff'], subItems: [
      { labelKey: 'viewTasks', icon: ListTodo },
      { labelKey: 'dailyChecklist', icon: ListChecks }
    ]},
    { titleKey: 'mealsPrep', icon: ClipboardCheck, roles: ['staff'], subItems: [
      { labelKey: 'mealPreparation', icon: ChefHat },
      { labelKey: 'dietaryRequirements', icon: Apple }
    ]},
    { titleKey: 'transportation', icon: ClipboardCheck, roles: ['staff'], subItems: [
      { labelKey: 'pickupLog', icon: Bus },
      { labelKey: 'dropOffLog', icon: MapPin }
    ]},
    { titleKey: 'liveStream', icon: Video, path: `/dashboard/${user.role}/live-stream`, roles: ['admin', 'reception', 'teacher', 'parent'], isLiveBadge: true },
    { titleKey: 'communication', icon: MessageSquare, path: `/dashboard/${user.role}/communication`, roles: ['admin', 'teacher', 'parent', 'reception'] },
  ];

  const filteredMenu = navigationConfig.filter(item => item.roles.includes(user.role));
  const getLabel = (item) => item.titleKey ? t(item.titleKey) : item.title;
  const getSubLabel = (sub) => sub.labelKey ? t(sub.labelKey) : sub.label;
  const getSlug = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const getSubPath = (sub) => sub.path || `/dashboard/${user.role}/${getSlug(sub.labelKey ? sub.labelKey : sub.label)}`;

  useEffect(() => {
    const activeParent = filteredMenu.find((item) =>
      item.subItems?.some((sub) => {
        const subPath = getSubPath(sub);
        return location.pathname === subPath || location.pathname.startsWith(subPath);
      })
    );

    if (activeParent) {
      setOpenMenu(activeParent.title || activeParent.titleKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <>
      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}
        style={{
          width: isCollapsed ? '72px' : '270px',
          transform: `translateX(${translateX})`,
          transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1), transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          overflow: 'hidden',
          zIndex: 150,
        }}
      >
        {isMobile ? (
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-3.5 right-3 z-[10] w-8 h-8 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-all duration-200"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <i className="bx bx-x text-2xl" />
          </button>
        ) : !isCollapsed ? (
          <button
            onClick={toggle}
            className="absolute top-3.5 right-3 z-[10] w-8 h-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : null}

        {isCollapsed ? (
          <div
            className="brand-collapsed"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '16px 8px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            {/* Centered Logo Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
                borderRadius: '14px',
                padding: '6px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.28), 0 1px 4px rgba(0,0,0,0.18)',
                flexShrink: 0,
              }}
            >
              <img
                src="/assets/optimized/mint-logo.webp"
                alt="Daycare Logo"
                style={{
                  height: '32px',
                  width: '32px',
                  objectFit: 'contain',
                  display: 'block',
                  borderRadius: '6px',
                }}
              />
            </div>

            {/* Minimizer / Expand Toggle Button */}
            <button
              onClick={toggle}
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-teal-200/80 hover:text-white hover:bg-white/10 border border-white/10 transition-all duration-200 cursor-pointer shadow-sm group"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4 text-teal-300 group-hover:text-white transition-colors" />
            </button>
          </div>
        ) : (
          <div
            className="brand"
            style={{
              paddingLeft: '14px',
              paddingRight: '44px',
            }}
          >
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ffffff',
              borderRadius: '16px',
              padding: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.28), 0 1px 4px rgba(0,0,0,0.18)',
              flexShrink: 0,
            }}>
              <img
                src="/assets/optimized/mint-logo.webp"
                alt="Daycare Logo"
                style={{
                  height: '44px',
                  width: '44px',
                  objectFit: 'contain',
                  display: 'block',
                  borderRadius: '8px',
                }}
              />
            </div>
            <div style={{ marginLeft: '10px', lineHeight: 1.2 }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>{t('daycare')}</p>
              <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.60)', whiteSpace: 'nowrap', marginTop: '2px' }}>{portalLabel}</p>
            </div>
          </div>
        )}

        <div className="nav-menu-container flex-1 min-h-0 pt-4">
          <ul className="nav-menu space-y-1">
            {filteredMenu.map(item => {
              const hasSub = item.subItems && item.subItems.length > 0;
              const label = getLabel(item);
              const isChildActive = hasSub && item.subItems.some((sub) => {
                const subPath = getSubPath(sub);
                return location.pathname === subPath || location.pathname.startsWith(subPath);
              });
              const isOpen = openMenu === item.title || openMenu === item.titleKey || isChildActive;

              return (
                <li key={label} className={`nav-item ${hasSub ? 'has-sub' : ''} ${isOpen ? 'open' : ''} ${isChildActive ? 'active' : ''}`}>
                  {hasSub ? (
                    <button
                      onClick={() => {
                        toggleSubmenu(item.title || item.titleKey);
                        if (item.path) {
                          handleNavClick();
                          navigate(item.path);
                        }
                      }}
                      className={`nav-link w-full text-left flex items-center justify-between px-3 py-2 rounded-2xl transition-all ${isChildActive || (item.path && location.pathname.includes(item.path)) ? 'bg-slate-900/5 text-slate-900 dark:bg-white/5 dark:text-white' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10'}`}
                      title={isCollapsed ? label : ''}
                    >
                      <div className="nav-link-left flex items-center gap-3">
                        <item.icon className="text-lg" />
                        {!isCollapsed && <span className="ml-2.5 whitespace-nowrap text-sm font-medium">{label}</span>}
                      </div>
                      {!isCollapsed && (
                        <ChevronDown className={`text-base transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      )}
                    </button>
                  ) : (
                    <NavLink
                      to={item.path}
                      onClick={handleNavClick}
                      className={({ isActive }) => `nav-link w-full text-left flex items-center justify-between px-3 py-2 rounded-2xl transition-all ${isActive ? 'bg-slate-900/5 text-slate-900 dark:bg-white/5 dark:text-white' : 'text-slate-500 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10'}`}
                      title={isCollapsed ? label : ''}
                    >
                      <div className="nav-link-left flex items-center gap-3 min-w-0">
                        <div className="relative flex items-center justify-center">
                          <item.icon className="text-lg shrink-0" />
                          {isCollapsed && item.isLiveBadge && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          )}
                        </div>
                        {!isCollapsed && <span className="ml-2.5 whitespace-nowrap text-sm font-medium truncate">{label}</span>}
                      </div>
                      {!isCollapsed && item.isLiveBadge && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </NavLink>
                  )}

                  {hasSub && isOpen && !isCollapsed && (
                    <ul className="sub-menu mt-2 space-y-2 pl-2">
                      {item.subItems.map((sub, idx) => {
                        const SubIcon = sub.icon;
                        const isComponentIcon = SubIcon && (typeof SubIcon === 'function' || typeof SubIcon === 'object');
                        return (
                          <li key={`${label}-${idx}`}>
                            <NavLink
                              to={getSubPath(sub)}
                              onClick={handleNavClick}
                              className={({ isActive }) => isActive ? 'active' : ''}
                            >
                              {isComponentIcon ? (
                                <SubIcon className="w-4 h-4 shrink-0" />
                              ) : typeof sub.icon === 'string' ? (
                                <i className={`bx ${sub.icon} text-base`} />
                              ) : null}
                              <span className="text-sm">{getSubLabel(sub)}</span>
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div
          className="sidebar-footer"
          style={{
            padding: isCollapsed ? '12px 8px' : '16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {isCollapsed ? (
            <button
              onClick={logout}
              type="button"
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white/80 hover:text-white hover:bg-rose-500/20 hover:border-rose-500/40 border border-white/10 bg-white/5 transition-all cursor-pointer shadow-sm group"
              title={t('signOut')}
              aria-label={t('signOut')}
            >
              <i className="bx bx-log-out text-xl group-hover:scale-110 group-hover:text-rose-400 transition-transform" />
            </button>
          ) : (
            <button
              onClick={logout}
              className="sidebar-signout-button w-full flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}
              title={t('signOut')}
            >
              <div className="flex items-center gap-3">
                <span
                  className="sidebar-signout-icon flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm"
                  style={{ backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)' }}
                >
                  <i className="bx bx-log-out text-xl" />
                </span>
                <span>{t('signOut')}</span>
              </div>
              <ChevronLeft className="text-base text-white/80" />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
