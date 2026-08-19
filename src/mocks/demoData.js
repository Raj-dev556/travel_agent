const today = new Date();
const iso = (offset) => {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

export const tenants = [
  { id: 'tenant-001', name: 'Dummy Corp India Pvt Ltd', subdomain: 'dummy-corp' },
  { id: 'tenant-002', name: 'BMW India Travel Demo', subdomain: 'bmwindia' },
];

export const designations = [
  { code: 'CEO', name: 'Chief Executive Officer', department: 'Executive', level: 1, status: 'Active', description: 'Company leadership' },
  { code: 'FIN-DIR', name: 'Finance Director', department: 'Finance', level: 2, status: 'Active', description: 'Budget approvals and controls' },
  { code: 'HR-MGR', name: 'HR Operations Manager', department: 'Human Resources', level: 3, status: 'Active', description: 'Employee lifecycle operations' },
  { code: 'TRAVEL-LEAD', name: 'Travel Desk Lead', department: 'Travel Operations', level: 3, status: 'Active', description: 'Booking fulfilment' },
  { code: 'SALES-MGR', name: 'Regional Sales Manager', department: 'Sales', level: 4, status: 'Active', description: 'Regional commercial owner' },
  { code: 'CONSULTANT', name: 'Implementation Consultant', department: 'Projects', level: 5, status: 'Active', description: 'Client delivery specialist' },
];

export const teams = [
  { id: 'TEAM-EXEC', name: 'Executive Office', department: 'Executive', cost_center: 'CC-1000', lead_employee_id: 'EMP-1001', parent_team_id: null, status: 'Active' },
  { id: 'TEAM-FIN', name: 'Finance Control', department: 'Finance', cost_center: 'CC-2100', lead_employee_id: 'EMP-1002', parent_team_id: 'TEAM-EXEC', status: 'Active' },
  { id: 'TEAM-HR', name: 'People Operations', department: 'Human Resources', cost_center: 'CC-3100', lead_employee_id: 'EMP-1003', parent_team_id: 'TEAM-EXEC', status: 'Active' },
  { id: 'TEAM-TRAVEL', name: 'Travel Desk', department: 'Travel Operations', cost_center: 'CC-4100', lead_employee_id: 'EMP-1004', parent_team_id: 'TEAM-HR', status: 'Active' },
  { id: 'TEAM-SALES-W', name: 'West Enterprise Sales', department: 'Sales', cost_center: 'CC-5100', lead_employee_id: 'EMP-1005', parent_team_id: 'TEAM-EXEC', status: 'Active' },
  { id: 'TEAM-PROJ', name: 'Client Delivery', department: 'Projects', cost_center: 'CC-6100', lead_employee_id: 'EMP-1006', parent_team_id: 'TEAM-SALES-W', status: 'Active' },
];

export const employees = [
  { id: 'EMP-1001', name: 'Aarav Mehta', email: 'aarav.mehta@dummy.example.test', department: 'Executive', unit: 'Corporate', grade: 'G2', team_id: 'TEAM-EXEC', manager: '', designation: 'Chief Executive Officer', designation_code: 'CEO', roles: ['Company Admin'], joined: '2021-04-05', mobile: '+919810010001', status: 'Active' },
  { id: 'EMP-1002', name: 'Nisha Rao', email: 'nisha.rao@dummy.example.test', department: 'Finance', unit: 'Corporate', grade: 'G3', team_id: 'TEAM-FIN', manager: 'aarav.mehta@dummy.example.test', designation: 'Finance Director', designation_code: 'FIN-DIR', roles: ['Finance Approver'], joined: '2022-01-17', mobile: '+919810010002', status: 'Active' },
  { id: 'EMP-1003', name: 'Priya Shah', email: 'priya.shah@dummy.example.test', department: 'Human Resources', unit: 'Corporate', grade: 'G3', team_id: 'TEAM-HR', manager: 'aarav.mehta@dummy.example.test', designation: 'HR Operations Manager', designation_code: 'HR-MGR', roles: ['HR Admin'], joined: '2022-03-11', mobile: '+919810010003', status: 'Active' },
  { id: 'EMP-1004', name: 'Kabir Sethi', email: 'kabir.sethi@dummy.example.test', department: 'Travel Operations', unit: 'Corporate', grade: 'G4', team_id: 'TEAM-TRAVEL', manager: 'priya.shah@dummy.example.test', designation: 'Travel Desk Lead', designation_code: 'TRAVEL-LEAD', roles: ['Travel Desk'], joined: '2023-06-21', mobile: '+919810010004', status: 'Active' },
  { id: 'EMP-1005', name: 'Rhea Iyer', email: 'rhea.iyer@dummy.example.test', department: 'Sales', unit: 'West', grade: 'G4', team_id: 'TEAM-SALES-W', manager: 'aarav.mehta@dummy.example.test', designation: 'Regional Sales Manager', designation_code: 'SALES-MGR', roles: ['Reporting Manager'], joined: '2020-11-09', mobile: '+919810010005', status: 'Active' },
  { id: 'EMP-1006', name: 'Arjun Menon', email: 'arjun.menon@dummy.example.test', department: 'Projects', unit: 'West', grade: 'G5', team_id: 'TEAM-PROJ', manager: 'rhea.iyer@dummy.example.test', designation: 'Implementation Consultant', designation_code: 'CONSULTANT', roles: ['Employee'], joined: '2024-02-14', mobile: '+919810010006', status: 'Active' },
  { id: 'EMP-1007', name: 'Sara Fernandes', email: 'sara.fernandes@dummy.example.test', department: 'Projects', unit: 'South', grade: 'G5', team_id: 'TEAM-PROJ', manager: 'rhea.iyer@dummy.example.test', designation: 'Implementation Consultant', designation_code: 'CONSULTANT', roles: ['Employee', 'Visa Operations'], joined: '2024-08-01', mobile: '+919810010007', status: 'Active' },
  { id: 'EMP-1008', name: 'Vikram Bansal', email: 'vikram.bansal@dummy.example.test', department: 'Sales', unit: 'North', grade: 'G4', team_id: 'TEAM-SALES-W', manager: 'rhea.iyer@dummy.example.test', designation: 'Regional Sales Manager', designation_code: 'SALES-MGR', roles: ['Employee'], joined: '2023-10-02', mobile: '+919810010008', status: 'Inactive' },
];

export const users = [
  { id: 'USR-001', fullName: 'Aarav Mehta', email: 'admin@dummy.example.test', employeeId: 'EMP-1001', roles: ['Company Admin'], emailVerified: true, status: 'Active' },
  { id: 'USR-002', fullName: 'Priya Shah', email: 'hr@dummy.example.test', employeeId: 'EMP-1003', roles: ['HR Admin'], emailVerified: true, status: 'Active' },
  { id: 'USR-003', fullName: 'Nisha Rao', email: 'finance@dummy.example.test', employeeId: 'EMP-1002', roles: ['Finance Approver'], emailVerified: true, status: 'Active' },
  { id: 'USR-004', fullName: 'Rhea Iyer', email: 'manager@dummy.example.test', employeeId: 'EMP-1005', roles: ['Reporting Manager'], emailVerified: true, status: 'Active' },
  { id: 'USR-005', fullName: 'Kabir Sethi', email: 'desk@dummy.example.test', employeeId: 'EMP-1004', roles: ['Travel Desk'], emailVerified: true, status: 'Active' },
  { id: 'USR-006', fullName: 'Sara Fernandes', email: 'visa@dummy.example.test', employeeId: 'EMP-1007', roles: ['Visa Operations'], emailVerified: true, status: 'Active' },
  { id: 'USR-007', fullName: 'Arjun Menon', email: 'traveler.one@dummy.example.test', employeeId: 'EMP-1006', roles: ['Employee'], emailVerified: true, status: 'Active' },
];

export const gradePolicies = [
  { grade: 'G2', domestic: 'Business', international: 'Business', hotel: '5 Star', perDiemInr: 9000, perDiemUsd: 220, advance: 450000, cab: 7500, visa: 'Y' },
  { grade: 'G3', domestic: 'Premium Economy', international: 'Business', hotel: '5 Star', perDiemInr: 7500, perDiemUsd: 180, advance: 300000, cab: 6000, visa: 'Y' },
  { grade: 'G4', domestic: 'Economy', international: 'Premium Economy', hotel: '4 Star', perDiemInr: 5500, perDiemUsd: 130, advance: 225000, cab: 4500, visa: 'Y' },
  { grade: 'G5', domestic: 'Economy', international: 'Premium Economy', hotel: '3 Star', perDiemInr: 4500, perDiemUsd: 110, advance: 175000, cab: 3500, visa: 'Y' },
];

export const budgets = [
  { id: 'BUD-2026-SALES-W', name: 'West Sales FY26 Travel', owner_type: 'Team', owner_id: 'TEAM-SALES-W', cycle: 'Annual', start_date: '2026-04-01', end_date: '2027-03-31', allocated_amount: 18500000, reserved_amount: 2400000, consumed_amount: 6850000, remaining_amount: 9250000, currency: 'INR', alert_threshold_percent: 80, rollover: false, status: 'Active' },
  { id: 'BUD-2026-PROJ', name: 'Client Delivery Travel Pool', owner_type: 'Team', owner_id: 'TEAM-PROJ', cycle: 'Annual', start_date: '2026-04-01', end_date: '2027-03-31', allocated_amount: 12500000, reserved_amount: 1650000, consumed_amount: 4200000, remaining_amount: 6650000, currency: 'INR', alert_threshold_percent: 85, rollover: false, status: 'Active' },
  { id: 'BUD-2026-EXEC', name: 'Executive Leadership Travel', owner_type: 'Department', owner_id: 'Executive', cycle: 'Annual', start_date: '2026-04-01', end_date: '2027-03-31', allocated_amount: 9000000, reserved_amount: 900000, consumed_amount: 3100000, remaining_amount: 5000000, currency: 'INR', alert_threshold_percent: 75, rollover: true, status: 'Active' },
];

export const trips = [
  { id: 'TRIP-2608-001', title: 'Mumbai client steering committee', requester_employee_id: 'EMP-1006', travelers: [{ employee_id: 'EMP-1006', budget_id: 'BUD-2026-PROJ', estimated_cost: 58000 }], trip_type: 'Single', travel_type: 'Domestic', purpose: 'Quarterly implementation review with Reliance Retail', source_city: 'Pune', destination_city: 'Mumbai', start_date: iso(5), end_date: iso(7), estimated_cost: 58000, currency: 'INR', status: 'Draft', current_approval_stage: 'Manager', policy_exception: false, budget_exception: false, cost_center: 'CC-6100', project_code: 'PRJ-RRL-26' },
  { id: 'TRIP-2608-002', title: 'Singapore partner enablement workshop', requester_employee_id: 'EMP-1005', travelers: [{ employee_id: 'EMP-1005', budget_id: 'BUD-2026-SALES-W', estimated_cost: 242000 }, { employee_id: 'EMP-1007', budget_id: 'BUD-2026-PROJ', estimated_cost: 198000 }], trip_type: 'Group', travel_type: 'International', purpose: 'APAC channel onboarding and investor roadshow support', source_city: 'Bengaluru', destination_city: 'Singapore', start_date: iso(12), end_date: iso(17), estimated_cost: 440000, currency: 'INR', status: 'Approved', current_approval_stage: 'Travel Desk', policy_exception: true, budget_exception: false, cost_center: 'CC-5100', project_code: 'APAC-GTM-26' },
  { id: 'TRIP-2608-003', title: 'Delhi finance audit review', requester_employee_id: 'EMP-1002', travelers: [{ employee_id: 'EMP-1002', budget_id: 'BUD-2026-EXEC', estimated_cost: 96000 }], trip_type: 'Single', travel_type: 'Domestic', purpose: 'Statutory audit and vendor payment closure', source_city: 'Mumbai', destination_city: 'Delhi', start_date: iso(20), end_date: iso(22), estimated_cost: 96000, currency: 'INR', status: 'Booking In Progress', current_approval_stage: 'Travel Desk', policy_exception: false, budget_exception: false, cost_center: 'CC-2100', project_code: 'FIN-AUDIT-Q2' },
];

export const approvals = [
  { id: 'APR-001', trip_id: 'TRIP-2608-001', stage: 'Manager', approver_employee_id: 'EMP-1005', status: 'Pending', comments: '' },
  { id: 'APR-002', trip_id: 'TRIP-2608-002', stage: 'Manager', approver_employee_id: 'EMP-1001', status: 'Approved', comments: 'Approved for APAC partner workshop.' },
  { id: 'APR-003', trip_id: 'TRIP-2608-002', stage: 'Finance', approver_employee_id: 'EMP-1002', status: 'Approved', comments: 'Budget available in Sales pool.' },
  { id: 'APR-004', trip_id: 'TRIP-2608-003', stage: 'Finance', approver_employee_id: 'EMP-1001', status: 'Approved', comments: 'Proceed with bookings.' },
];

export const tripComponents = [
  { id: 'CMP-001', trip_id: 'TRIP-2608-002', traveler_employee_id: 'EMP-1005', component_type: 'Flight', provider: 'Air India', description: 'BLR-SIN-BLR business fare', start_date: iso(12), end_date: iso(17), estimated_cost: 168000, actual_cost: 162500, currency: 'INR', status: 'Booked', policy_compliant: false },
  { id: 'CMP-002', trip_id: 'TRIP-2608-002', traveler_employee_id: 'EMP-1007', component_type: 'Hotel', provider: 'Parkroyal Collection Marina Bay', description: '5 nights, twin rooms', start_date: iso(12), end_date: iso(17), estimated_cost: 188000, actual_cost: 181400, currency: 'INR', status: 'Booked', policy_compliant: true },
  { id: 'CMP-003', trip_id: 'TRIP-2608-003', traveler_employee_id: 'EMP-1002', component_type: 'Flight', provider: 'Vistara', description: 'BOM-DEL-BOM flexible fare', start_date: iso(20), end_date: iso(22), estimated_cost: 44000, actual_cost: null, currency: 'INR', status: 'Requested', policy_compliant: true },
];

export const visas = [
  { id: 'VISA-2608-001', trip_id: 'TRIP-2608-002', employee_id: 'EMP-1007', destination_country: 'Singapore', visa_type: 'Business', fee: 6200, currency: 'INR', required_documents: ['Passport', 'Invitation letter', 'Company cover letter'], status: 'Appointment Scheduled' },
  { id: 'VISA-2608-002', trip_id: 'TRIP-2608-002', employee_id: 'EMP-1005', destination_country: 'Singapore', visa_type: 'Business', fee: 6200, currency: 'INR', required_documents: ['Passport', 'Invitation letter'], status: 'Documents Received' },
];

export const airports = [
  { code: 'PNQ', city: 'Pune', name: 'Pune International Airport', country: 'India' },
  { code: 'BLR', city: 'Bengaluru', name: 'Kempegowda International Airport', country: 'India' },
  { code: 'BOM', city: 'Mumbai', name: 'Chhatrapati Shivaji Maharaj International Airport', country: 'India' },
  { code: 'DEL', city: 'Delhi', name: 'Indira Gandhi International Airport', country: 'India' },
  { code: 'MAA', city: 'Chennai', name: 'Chennai International Airport', country: 'India' },
  { code: 'HYD', city: 'Hyderabad', name: 'Rajiv Gandhi International Airport', country: 'India' },
  { code: 'SIN', city: 'Singapore', name: 'Singapore Changi Airport', country: 'Singapore' },
  { code: 'DXB', city: 'Dubai', name: 'Dubai International Airport', country: 'United Arab Emirates' },
];

export const airlines = [
  { code: 'AI', name: 'Air India' },
  { code: '6E', name: 'IndiGo' },
  { code: 'UK', name: 'Vistara' },
  { code: 'QP', name: 'Akasa Air' },
  { code: 'SG', name: 'SpiceJet' },
  { code: 'SQ', name: 'Singapore Airlines' },
];

export const hotelCities = [
  { id: '1001', cityRegionId: 1001, name: 'MUMBAI', displayName: 'MUMBAI', regionName: 'Mumbai', countryName: 'India', type: 'CITY', fullRegionName: 'Mumbai, Maharashtra, India' },
  { id: '1002', cityRegionId: 1002, name: 'BENGALURU', displayName: 'BENGALURU', regionName: 'Bengaluru', countryName: 'India', type: 'CITY', fullRegionName: 'Bengaluru, Karnataka, India' },
  { id: '1003', cityRegionId: 1003, name: 'DELHI', displayName: 'DELHI', regionName: 'Delhi', countryName: 'India', type: 'CITY', fullRegionName: 'Delhi, India' },
  { id: '1004', cityRegionId: 1004, name: 'SINGAPORE', displayName: 'SINGAPORE', regionName: 'Singapore', countryName: 'Singapore', type: 'CITY', fullRegionName: 'Singapore' },
];

export const hotels = [
  { tjHotelId: '700101', hotelId: '700101', name: 'Taj Lands End Mumbai', city: 'Mumbai', regionName: 'Bandra West', propertyType: 'Hotel', starRating: 5, mealBasis: 'Breakfast Included', totalRateINR: 24500, nightlyRateINR: 12250, reviewScore: 4.7, reviewCount: 1832, amenities: ['Sea view', 'Airport transfer', 'Breakfast', 'Gym'], latitude: 19.0437, longitude: 72.8194 },
  { tjHotelId: '700102', hotelId: '700102', name: 'Trident Bandra Kurla', city: 'Mumbai', regionName: 'BKC', propertyType: 'Business Hotel', starRating: 5, mealBasis: 'Room Only', totalRateINR: 21800, nightlyRateINR: 10900, reviewScore: 4.6, reviewCount: 1464, amenities: ['Wi-Fi', 'Workspace', 'Breakfast', 'Pool'], latitude: 19.0662, longitude: 72.8675 },
  { tjHotelId: '700201', hotelId: '700201', name: 'The Oberoi Bengaluru', city: 'Bengaluru', regionName: 'MG Road', propertyType: 'Hotel', starRating: 5, mealBasis: 'Breakfast Included', totalRateINR: 19600, nightlyRateINR: 9800, reviewScore: 4.8, reviewCount: 2210, amenities: ['Garden view', 'Breakfast', 'Gym', 'Pool'], latitude: 12.9735, longitude: 77.6194 },
  { tjHotelId: '700202', hotelId: '700202', name: 'Radisson Blu Atria Bengaluru', city: 'Bengaluru', regionName: 'Palace Road', propertyType: 'Hotel', starRating: 4, mealBasis: 'Breakfast Included', totalRateINR: 13200, nightlyRateINR: 6600, reviewScore: 4.2, reviewCount: 978, amenities: ['Wi-Fi', 'Breakfast', 'Conference room'], latitude: 12.9844, longitude: 77.5879 },
  { tjHotelId: '700301', hotelId: '700301', name: 'Roseate House New Delhi', city: 'Delhi', regionName: 'Aerocity', propertyType: 'Hotel', starRating: 5, mealBasis: 'Breakfast Included', totalRateINR: 17400, nightlyRateINR: 8700, reviewScore: 4.5, reviewCount: 1304, amenities: ['Airport transfer', 'Breakfast', 'Spa'], latitude: 28.5512, longitude: 77.1211 },
  { tjHotelId: '700401', hotelId: '700401', name: 'Parkroyal Collection Marina Bay', city: 'Singapore', regionName: 'Marina Bay', propertyType: 'Hotel', starRating: 5, mealBasis: 'Breakfast Included', totalRateINR: 38600, nightlyRateINR: 19300, reviewScore: 4.7, reviewCount: 2418, amenities: ['Marina view', 'Breakfast', 'Business centre'], latitude: 1.2917, longitude: 103.8572 },
];

export const countries = [
  { code: 'IN', id: '106', name: 'India' },
  { code: 'SG', id: '196', name: 'Singapore' },
  { code: 'AE', id: '229', name: 'United Arab Emirates' },
  { code: 'US', id: '233', name: 'United States' },
];

export const mockState = {
  tenants: [...tenants],
  users: [...users],
  employees: [...employees],
  designations: [...designations],
  teams: teams.map((team) => ({
    ...team,
    member_count: employees.filter((employee) => employee.team_id === team.id).length,
  })),
  gradePolicies: [...gradePolicies],
  budgets: [...budgets],
  trips: [...trips],
  approvals: [...approvals],
  tripComponents: [...tripComponents],
  visas: [...visas],
  flightBookings: new Map(),
  hotelBookings: new Map(),
};
