import { useParams } from 'react-router-dom';
import Dashboard from '../../pages/Dashboard';

export function EmployeeMasterPage() {
  return <Dashboard sectionId="employees" action="listing" />;
}

export function EmployeeCreatePage() {
  return <Dashboard sectionId="employees" action="create" />;
}

export function EmployeeEditPage() {
  const { employeeId } = useParams();
  return <Dashboard sectionId="employees" action="edit" itemId={employeeId} />;
}

export function EmployeeUploadPage() {
  return <Dashboard sectionId="employees" action="upload" />;
}

export function GradePoliciesPage() {
  return <Dashboard sectionId="policies" action="listing" />;
}

export function OrganizationHierarchyPage() {
  return <Dashboard sectionId="hierarchy" />;
}

export function DesignationMasterPage() {
  return <Dashboard sectionId="designations" />;
}

export function GradePolicyCreatePage() {
  return <Dashboard sectionId="policies" action="create" />;
}

export function GradePolicyEditPage() {
  const { grade } = useParams();
  return <Dashboard sectionId="policies" action="edit" itemId={grade} />;
}

export function GradePolicyUploadPage() {
  return <Dashboard sectionId="policies" action="upload" />;
}

export function BudgetsPage() {
  return <Dashboard sectionId="budgets" action="unit" />;
}

export function ProjectBudgetsPage() {
  return <Dashboard sectionId="budgets" action="project" />;
}

export function BudgetCreatePage() {
  return <Dashboard sectionId="budgets" action="create" />;
}

export function BudgetEditPage() {
  const { budgetId } = useParams();
  return <Dashboard sectionId="budgets" action="edit" itemId={budgetId} />;
}

export function BudgetUploadPage() {
  return <Dashboard sectionId="budgets" action="upload" />;
}

export function TripLifecyclePage() {
  return <Dashboard sectionId="trips" action="listing" />;
}

export function TripCreatePage() {
  return <Dashboard sectionId="trips" action="create" />;
}

export function TripEditPage() {
  const { tripId } = useParams();
  return <Dashboard sectionId="trips" action="edit" itemId={tripId} />;
}

export function TripApprovalPage() {
  const { tripId } = useParams();
  return <Dashboard sectionId="trips" action="approval" itemId={tripId} />;
}

export function BookingCalendarPage() {
  return <Dashboard sectionId="calendar" />;
}

export function VisaOperationsPage() {
  return <Dashboard sectionId="visa" />;
}

export function ReportsPage() {
  return <Dashboard sectionId="reports" />;
}

export function UserAccessPage() {
  return <Dashboard sectionId="access" />;
}
