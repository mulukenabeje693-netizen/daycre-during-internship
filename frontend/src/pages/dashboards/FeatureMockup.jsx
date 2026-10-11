import React, { Suspense, lazy } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import LoadingFallback from '../../components/common/LoadingFallback';
import { ChunkErrorBoundary } from '../../components/common/ChunkErrorBoundary';

// Lazy-loaded feature pages
const ChildList = lazy(() => import('../features/ChildList'));
const AttendanceTracker = lazy(() => import('../features/AttendanceTracker'));
const StaffAttendance = lazy(() => import('../features/StaffAttendance'));
const StudentAttendance = lazy(() => import('../features/StudentAttendance'));
const PaymentList = lazy(() => import('../features/PaymentList'));
const DailyReports = lazy(() => import('../features/DailyReports'));
const ClassroomList = lazy(() => import('../features/ClassroomList'));
const VisitorLog = lazy(() => import('../features/VisitorLog'));
const AppointmentCalendar = lazy(() => import('../features/AppointmentCalendar'));
const MessageInbox = lazy(() => import('../features/MessageInbox'));
const StaffList = lazy(() => import('../features/StaffList'));
const AddStaff = lazy(() => import('../features/AddStaff'));
const AssignRole = lazy(() => import('../features/AssignRole'));
const AssignTeacher = lazy(() => import('../features/AssignTeacher'));
const CapacityManagement = lazy(() => import('../features/CapacityManagement'));
const AssignedRoom = lazy(() => import('../features/AssignedRoom'));
const SleepNaps = lazy(() => import('../features/SleepNaps'));
const MealPrep = lazy(() => import('../features/MealPrep'));
const ActivitiesList = lazy(() => import('../features/ActivitiesList'));
const ParentManagement = lazy(() => import('../features/ParentManagement'));
const ReceptionRegisterParent = lazy(() => import('../features/ReceptionRegisterParent'));
const TeacherAttendance = lazy(() => import('../features/TeacherAttendance'));
const AdminApprovalWizard = lazy(() => import('../features/AdminApprovalWizard'));
const AdminTeacherAttendance = lazy(() => import('../features/AdminTeacherAttendance'));
const AttendanceDashboard = lazy(() => import('../features/AttendanceDashboard'));
const MakePayment = lazy(() => import('../features/MakePayment'));
const PaymentSuccess = lazy(() => import('../features/PaymentSuccess'));
const ChildProfile = lazy(() => import('../features/ChildProfile'));
const ClassroomRoom = lazy(() => import('../features/ClassroomRoom'));
const VaccinationLog = lazy(() => import('../features/VaccinationLog'));
const RegisterChild = lazy(() => import('../features/RegisterChild'));
const RegisterChildOnly = lazy(() => import('../features/RegisterChildOnly'));
const BalanceInfo = lazy(() => import('../features/BalanceInfo'));
const ReceiptsHistory = lazy(() => import('../features/ReceiptsHistory'));
const Communication = lazy(() => import('../features/Communication'));
const UpdateParentInfo = lazy(() => import('../features/UpdateParentInfo'));
const ChildApprovalNotifications = lazy(() => import('../features/ChildApprovalNotifications'));
const ChildIDGenerate = lazy(() => import('../features/ChildIDGenerate'));
const UpdateInfoTabs = lazy(() => import('../features/UpdateInfoTabs'));
const LiveStreamMonitoring = lazy(() => import('../features/LiveStreamMonitoring'));

const FeatureMockup = () => {
  const { role: roleParam, feature } = useParams();
  const location = useLocation();
  // role may come from URL param (:role/:feature) or must be extracted from pathname (/dashboard/admin/:feature)
  const role = roleParam || location.pathname.split('/')[2];
  const navigate = useNavigate();

  // Helper to map a URL slug to a real component
  const renderFeature = () => {
    const slug = feature?.toLowerCase() || '';

    // ── Parent: My Children ───────────────────────────────────────────────────
    if (slug === 'profile-card')    return <ChildProfile />;
    if (slug === 'classroom-room')  return <ClassroomRoom />;
    if (slug === 'registration-updates') return <ChildApprovalNotifications />;
    if (slug === 'vaccination-log' || slug === 'vaccinationlog' || slug.includes('vaccination')) return <VaccinationLog />;
    if (slug === 'new-child-registry') return <RegisterChild />;
    if (slug === 'register-child') return <RegisterChildOnly />;
    if (slug === 'update-info') return <UpdateInfoTabs />;
    if (slug === 'update-parent-info') return <UpdateParentInfo />;
    if (slug === 'child-id-generate') return <ChildIDGenerate />;
    if (slug === 'register-parent') return <ReceptionRegisterParent />;
    if (slug === 'child-attendance') return <AttendanceTracker />;

    // ── Payments (all sub-routes → unified tabbed page) ───────────────────────
    if (slug === 'make-payment') return <MakePayment />;
    if (slug === 'payment-success') return <PaymentSuccess />;
    if (slug === 'payments' || slug === 'balance-info' || slug === 'receipts-history' || slug === 'invoices' || slug === 'billing') return <PaymentList />;

    // ── Parent: Communication ─────────────────────────────────────────────────
    if (slug === 'announcements' || slug === 'communication') return <Communication />;
    if (slug === 'messages')      return <Communication />;

    // ── Real-time Live Video Streaming ─────────────────────────────────────────
    if (slug === 'live-stream' || slug === 'live-video' || slug.includes('stream') || slug.includes('cctv') || slug.includes('monitoring')) {
      return <LiveStreamMonitoring />;
    }

    // ── Attendance ────────────────────────────────────────────────────────────
    if (slug.includes('attendance') || slug.includes('check-in-out')) {
      if (slug === 'teacher-attendance' || slug === 'provider-attendance' || slug === 'nanny-attendance') {
        if (role === 'admin') return <AdminTeacherAttendance />;
        return <TeacherAttendance />;
      }
      if (slug === 'student-attendance') {
        return <StudentAttendance />;
      }
      if (slug === 'child-attendance') {
        if (role === 'admin') return <AttendanceTracker readOnly={true} />;
        return <AttendanceTracker />;
      }
      if (role === 'admin') return <AttendanceDashboard />;
      if (role === 'reception') return <AttendanceTracker />;
      if (role === 'teacher') return <AttendanceTracker />;
      return <AttendanceTracker />;
    }

    // ── Children Management ───────────────────────────────────────────────────
    if (slug.includes('child') || slug.includes('student') || slug.includes('roster')) {
      return <ChildList />;
    }

    // ── Payments / Invoices ───────────────────────────────────────────────────
    if (slug.includes('payment') || slug.includes('invoice')) {
      return <PaymentList />;
    }

    // ── Daily Reports ─────────────────────────────────────────────────────────
    if (slug.includes('report') || slug.includes('daily')) {
      return <DailyReports />;
    }

    // ── Activities ────────────────────────────────────────────────────────────
    if (slug.includes('activit')) return <ActivitiesList />;

    // ── Classrooms ────────────────────────────────────────────────────────────
    if (slug.includes('classroom')) return <ClassroomList />;

    // ── Capacity ──────────────────────────────────────────────────────────────
    if (slug.includes('capacity')) return <CapacityManagement />;

    // ── Teacher / Classroom Assignment ─────────────────────────────────────────
    if (slug === 'assign') return <AssignTeacher />;
    if (slug.includes('assigned') || slug.includes('assign-room')) return <AssignedRoom />;

    // ── Sleep / Naps ──────────────────────────────────────────────────────────
    if (slug.includes('sleep') || slug.includes('nap')) return <SleepNaps />;

    // ── Meals ─────────────────────────────────────────────────────────────────
    if (slug.includes('meal') || slug.includes('food') || slug.includes('prep') || slug.includes('kitchen')) {
      return <MealPrep />;
    }

    // ── Visitors ──────────────────────────────────────────────────────────────
    if (slug.includes('visitor')) return <VisitorLog />;

    // ── Appointments / Meetings ───────────────────────────────────────────────
    if (slug.includes('appointment') || slug.includes('meeting') || slug.includes('school-visit')) {
      return <AppointmentCalendar />;
    }

    // ── Messages / Inbox ──────────────────────────────────────────────────────
    if (slug.includes('message') || slug.includes('inbox') || slug.includes('sent')) {
      return <MessageInbox />;
    }

    // ── Staff ─────────────────────────────────────────────────────────────────
    if (slug === 'add-staff')        return <AddStaff />;
    if (slug === 'assign-role' || slug === 'assignments') return <AssignRole />;
    if (slug.includes('staff') || slug.includes('view-staff') || slug.includes('edit-delete-staff')) {
      return <StaffList />;
    }

    // ── Parent management ─────────────────────────────────────────────────────
    if (slug.includes('parent') || slug.includes('add-parent') || slug.includes('assign-children') || slug.includes('emergency')) {
      return <ParentManagement />;
    }
    if (slug === 'approvals') return <AdminApprovalWizard />;

    // ── Fallback ──────────────────────────────────────────────────────────────
    return (
      <div className="bg-white dark:bg-[#111c2d] rounded-2xl border border-slate-200 dark:border-teal-900/30 p-8 text-center">
        <div className="w-16 h-16 bg-indigo-50 dark:bg-[#0d1520] text-indigo-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
          <i className="bx bx-wrench"></i>
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Feature Under Construction</h3>
        <p className="text-slate-500 text-sm">
          The <strong>{feature}</strong> module is currently being built by the development team. Check back later!
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Each feature gets its own error boundary so a single chunk failure
          doesn't crash the whole dashboard layout */}
      <ChunkErrorBoundary label={feature || 'this feature'}>
        <div className="animate-fade-in">
          <Suspense fallback={<LoadingFallback message="Loading..." />}>
            {renderFeature()}
          </Suspense>
        </div>
      </ChunkErrorBoundary>
    </div>
  );
};

/**
 * Call this on sidebar link mouseenter to prefetch the target feature's
 * chunk before the user clicks. Dramatically reduces perceived navigation time.
 *
 * Usage in Sidebar.jsx:
 *   import { prefetchFeature } from './FeatureMockup';
 *   <Link onMouseEnter={() => prefetchFeature('communication')} to="...">...
 */
export function prefetchFeature(slug) {
  const s = (slug || '').toLowerCase();
  if (s.includes('communication') || s.includes('announcement') || s.includes('message')) {
    import('../features/Communication').catch(() => {});
  } else if (s.includes('stream') || s.includes('cctv') || s.includes('monitoring')) {
    import('../features/LiveStreamMonitoring').catch(() => {});
  } else if (s.includes('payment') || s.includes('invoice') || s.includes('billing')) {
    import('../features/PaymentList').catch(() => {});
  } else if (s.includes('attendance') || s.includes('check-in')) {
    import('../features/AttendanceTracker').catch(() => {});
  } else if (s.includes('child') || s.includes('student')) {
    import('../features/ChildList').catch(() => {});
  } else if (s.includes('staff')) {
    import('../features/StaffList').catch(() => {});
  } else if (s.includes('report') || s.includes('daily')) {
    import('../features/DailyReports').catch(() => {});
  } else if (s.includes('meal') || s.includes('food')) {
    import('../features/MealPrep').catch(() => {});
  }
}

export default FeatureMockup;
