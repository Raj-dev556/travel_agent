import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AppSkeleton from './components/AppSkeleton';
import Login from './pages/Login';
import Register from './pages/Register';
import { ActivateAccount, ForgotPassword, ResetPassword, VerifyEmail } from './pages/AccountAccess';
import { useAuthStore } from './store/auth';

const dashboardPage = (name) => lazy(() => import('./features/dashboard/pages').then((module) => ({ default: module[name] })));
const EmployeeMasterPage = dashboardPage('EmployeeMasterPage');
const EmployeeCreatePage = dashboardPage('EmployeeCreatePage');
const EmployeeEditPage = dashboardPage('EmployeeEditPage');
const EmployeeUploadPage = dashboardPage('EmployeeUploadPage');
const GradePoliciesPage = dashboardPage('GradePoliciesPage');
const OrganizationHierarchyPage = dashboardPage('OrganizationHierarchyPage');
const DesignationMasterPage = dashboardPage('DesignationMasterPage');
const GradePolicyCreatePage = dashboardPage('GradePolicyCreatePage');
const GradePolicyEditPage = dashboardPage('GradePolicyEditPage');
const GradePolicyUploadPage = dashboardPage('GradePolicyUploadPage');
const BudgetsPage = dashboardPage('BudgetsPage');
const ProjectBudgetsPage = dashboardPage('ProjectBudgetsPage');
const BudgetCreatePage = dashboardPage('BudgetCreatePage');
const BudgetEditPage = dashboardPage('BudgetEditPage');
const BudgetUploadPage = dashboardPage('BudgetUploadPage');
const TripLifecyclePage = dashboardPage('TripLifecyclePage');
const TripCreatePage = dashboardPage('TripCreatePage');
const TripEditPage = dashboardPage('TripEditPage');
const TripApprovalPage = dashboardPage('TripApprovalPage');
const BookingCalendarPage = dashboardPage('BookingCalendarPage');
const VisaOperationsPage = dashboardPage('VisaOperationsPage');
const ReportsPage = dashboardPage('ReportsPage');
const UserAccessPage = dashboardPage('UserAccessPage');
const FlightSearch = lazy(() => import('./pages/flights/FlightSearch'));
const FlightResults = lazy(() => import('./pages/flights/FlightResults'));
const FlightItinerary = lazy(() => import('./pages/flights/FlightItinerary'));
const FlightPassengerDetails = lazy(() => import('./pages/flights/FlightPassengerDetails'));
const FlightReview = lazy(() => import('./pages/flights/FlightReview'));
const FlightPayment = lazy(() => import('./pages/flights/FlightPayment'));
const FlightConfirm = lazy(() => import('./pages/flights/FlightConfirm'));
const HotelSearch = lazy(() => import('./pages/hotels/HotelSearch.jsx'));
const HotelResults = lazy(() => import('./pages/hotels/HotelResults.jsx'));
const HotelDetail = lazy(() => import('./pages/hotels/HotelDetail.jsx'));
const HotelBook = lazy(() => import('./pages/hotels/HotelBook.jsx'));
const HotelConfirm = lazy(() => import('./pages/hotels/HotelConfirm.jsx'));
const HotelInvoice = lazy(() => import('./pages/hotels/HotelInvoice.jsx'));
const Invoice = lazy(() => import('./pages/Invoice.jsx'));

function Protected({ children }) {
  const token = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  if (!hasHydrated) return <AppSkeleton />;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function RoleHome() {
  const roles = useAuthStore((state) => state.user?.roles || []);
  if (roles.includes('Company Admin') || roles.includes('HR Admin')) return <Navigate to="/employee-master" replace />;
  if (roles.includes('Finance Approver')) return <Navigate to="/budgets" replace />;
  if (roles.includes('Visa Operations')) return <Navigate to="/visa" replace />;
  return <Navigate to="/trip-lifecycle" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<AppSkeleton />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/activate-account" element={<ActivateAccount />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<RoleHome />} />
        <Route path="employee-master" element={<EmployeeMasterPage />} />
        <Route path="employee-master/create" element={<EmployeeCreatePage />} />
        <Route path="employee-master/:employeeId/edit" element={<EmployeeEditPage />} />
        <Route path="employee-master/upload" element={<EmployeeUploadPage />} />
        <Route path="grade-policies" element={<GradePoliciesPage />} />
        <Route path="organization-hierarchy" element={<OrganizationHierarchyPage />} />
        <Route path="designation-master" element={<DesignationMasterPage />} />
        <Route path="visa" element={<VisaOperationsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="user-access" element={<UserAccessPage />} />
        <Route path="invoice" element={<Invoice />} />
        <Route path="grade-policies/create" element={<GradePolicyCreatePage />} />
        <Route path="grade-policies/:grade/edit" element={<GradePolicyEditPage />} />
        <Route path="grade-policies/upload" element={<GradePolicyUploadPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="budgets/projects" element={<ProjectBudgetsPage />} />
        <Route path="budgets/create" element={<BudgetCreatePage />} />
        <Route path="budgets/:budgetId/edit" element={<BudgetEditPage />} />
        <Route path="budgets/upload" element={<BudgetUploadPage />} />
        <Route path="trip-lifecycle" element={<TripLifecyclePage />} />
        <Route path="trip-lifecycle/create" element={<TripCreatePage />} />
        <Route path="trip-lifecycle/:tripId/edit" element={<TripEditPage />} />
        <Route path="trip-lifecycle/:tripId/approval" element={<TripApprovalPage />} />
        <Route path="booking-calendar" element={<BookingCalendarPage />} />
        <Route path="flights" element={<FlightSearch />} />
        <Route path="flights/results" element={<FlightResults />} />
        <Route path="flights/itinerary" element={<FlightItinerary />} />
        <Route path="flights/passenger" element={<FlightPassengerDetails />} />
        <Route path="flights/review" element={<FlightReview />} />
        <Route path="flights/payment" element={<FlightPayment />} />
        <Route path="flights/confirm" element={<FlightConfirm />} />
        <Route path="hotels" element={<HotelSearch />} />
        <Route path="hotels/results" element={<HotelResults />} />
        <Route path="hotels/confirm" element={<HotelConfirm />} />
        <Route path="hotels/invoice" element={<HotelInvoice />} />
        <Route path="hotels/:id" element={<HotelDetail />} />
        <Route path="hotels/:id/book" element={<HotelBook />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
