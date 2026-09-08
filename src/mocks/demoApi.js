import {
  airlines,
  airports,
  countries,
  hotelCities,
  hotels,
  mockState,
} from './demoData';

const sleep = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = (value) => {
  if (value instanceof Blob) return value;
  return JSON.parse(JSON.stringify(value));
};

function response(config, data, status = 200) {
  return { data: clone(data), status, statusText: status === 200 ? 'OK' : 'Created', headers: {}, config };
}

function parsePath(url = '') {
  const parsed = new URL(String(url), 'https://demo.local');
  let path = parsed.pathname.replace(/^\/api(?=\/)/, '');
  if (!path.startsWith('/')) path = `/${path}`;
  return path.replace(/\/+$/, '') || '/';
}

function paramsFrom(config) {
  return { ...(config.params || {}) };
}

function bodyFrom(config) {
  if (!config.data) return {};
  if (typeof config.data === 'string') {
    try { return JSON.parse(config.data); } catch { return {}; }
  }
  return config.data;
}

function list(items, params = {}) {
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.max(1, Number(params.limit || items.length || 100));
  const start = (page - 1) * limit;
  const rows = items.slice(start, start + limit);
  return {
    items: clone(rows),
    data: clone(rows),
    total: items.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(items.length / limit)),
  };
}

function filterText(rows, value, fields) {
  const query = String(value || '').trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((row) => fields.some((field) => String(row[field] || '').toLowerCase().includes(query)));
}

function employeeLegacy(employee) {
  return {
    _id: employee.id,
    employeeCode: employee.id,
    fullName: employee.name,
    email: employee.email,
    department: employee.department,
    designation: employee.designation,
    mobile: employee.mobile,
  };
}

function tripLegacy(trip) {
  return {
    _id: trip.id,
    tripId: trip.id,
    title: trip.title,
    travelType: trip.travel_type,
    fromDate: trip.start_date,
    toDate: trip.end_date,
    origin: trip.source_city,
    destinations: [trip.destination_city],
    costEstimation: {
      flights: Math.round(trip.estimated_cost * 0.48),
      hotels: Math.round(trip.estimated_cost * 0.36),
      perDiem: Math.round(trip.estimated_cost * 0.12),
      totalEstimatedINR: trip.estimated_cost,
    },
    status: String(trip.status || '').toLowerCase().replace(/\s+/g, '_'),
    currentLevel: 1,
    approvalChain: mockState.approvals
      .filter((approval) => approval.trip_id === trip.id)
      .map((approval, index) => ({
        level: index + 1,
        role: approval.stage,
        action: approval.status === 'Pending' ? 'pending' : approval.status.toLowerCase(),
        approverEmail: mockState.employees.find((employee) => employee.id === approval.approver_employee_id)?.email,
        comment: approval.comments,
      })),
  };
}

function currentUserForEmail(email) {
  return mockState.users.find((user) => user.email.toLowerCase() === String(email || '').toLowerCase()) || mockState.users[0];
}

function hierarchyTree() {
  const byManager = new Map();
  mockState.employees.forEach((employee) => {
    const key = String(employee.manager || '').toLowerCase();
    byManager.set(key, [...(byManager.get(key) || []), employee]);
  });
  const build = (employee) => ({
    employee_id: employee.id,
    name: employee.name,
    designation: employee.designation,
    grade: employee.grade,
    reports: (byManager.get(employee.email.toLowerCase()) || []).map(build),
  });
  return (byManager.get('') || []).map(build);
}

function dashboardSummary() {
  const activeEmployees = mockState.employees.filter((employee) => employee.status === 'Active').length;
  const allocated = mockState.budgets.reduce((sum, budget) => sum + Number(budget.allocated_amount || 0), 0);
  const consumed = mockState.budgets.reduce((sum, budget) => sum + Number(budget.consumed_amount || 0), 0);
  return {
    employees: { active: activeEmployees, inactive: mockState.employees.length - activeEmployees },
    grade_policies: { total: mockState.gradePolicies.length, updated_this_month: 2 },
    budgets: { allocated, consumed, balance: allocated - consumed, active_pools: mockState.budgets.filter((budget) => budget.status === 'Active').length },
    trips: { open: mockState.trips.filter((trip) => !['Booked', 'Cancelled', 'Rejected'].includes(trip.status)).length, awaiting_approval: mockState.approvals.filter((approval) => approval.status === 'Pending').length },
    approvals_pending: mockState.approvals.filter((approval) => approval.status === 'Pending').length,
    visas_pending: mockState.visas.filter((visa) => !['Delivered', 'Rejected'].includes(visa.status)).length,
  };
}

function hotelRows(body = {}) {
  const cityId = Number(body.cityRegionId || body.searchQuery?.cityRegionId || 0);
  const city = hotelCities.find((item) => Number(item.cityRegionId) === cityId)?.regionName;
  let rows = city ? hotels.filter((hotel) => hotel.city.toLowerCase() === city.toLowerCase()) : hotels;
  if (city && rows.length < 6) {
    const selectedIds = new Set(rows.map((hotel) => hotel.tjHotelId));
    const supplementalRows = hotels.filter((hotel) => !selectedIds.has(hotel.tjHotelId));
    rows = [...rows, ...supplementalRows].slice(0, 8);
  }
  const filters = body.appliedFilters || {};
  if (filters.hotelName) rows = filterText(rows, filters.hotelName, ['name']);
  if (filters.ratings?.length) rows = rows.filter((hotel) => filters.ratings.includes(String(hotel.starRating)));
  if (filters.propertyTypes?.length) rows = rows.filter((hotel) => filters.propertyTypes.includes(hotel.propertyType));
  if (filters.mealType?.length) rows = rows.filter((hotel) => filters.mealType.some((meal) => hotel.mealBasis.toUpperCase().includes(String(meal).toUpperCase())));
  if (String(body.sortOrder || '').includes('price_low')) rows = [...rows].sort((a, b) => a.totalRateINR - b.totalRateINR);
  if (String(body.sortOrder || '').includes('price_high')) rows = [...rows].sort((a, b) => b.totalRateINR - a.totalRateINR);
  if (String(body.sortOrder || '').includes('star_high')) rows = [...rows].sort((a, b) => b.starRating - a.starRating);
  return rows;
}

function hotelListing(config) {
  const body = bodyFrom(config);
  const rows = hotelRows(body);
  const page = Number(body.pagination?.page || 1);
  const limit = Number(body.pagination?.limit || 10);
  const paged = rows.slice((page - 1) * limit, page * limit);
  return {
    hotels: paged,
    hotelCount: rows.length,
    availableHotelCount: rows.length,
    scanComplete: true,
    pagination: { page, limit, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / limit)) },
  };
}

function hotelFilters(config) {
  const rows = hotelRows(bodyFrom(config));
  const bucket = (key) => Object.values(rows.reduce((acc, hotel) => {
    const value = hotel[key];
    acc[value] = acc[value] || { value: String(value), label: String(value), count: 0 };
    acc[value].count += 1;
    return acc;
  }, {}));
  return {
    availableHotelCount: rows.length,
    hotelCount: rows.length,
    filters: {
      propertyType: bucket('propertyType'),
      popularPlaces: bucket('regionName'),
      starCategory: bucket('starRating'),
      mealBasis: bucket('mealBasis'),
      priceRange: [
        { value: '0$10000', min: 0, max: 10000, count: rows.filter((hotel) => hotel.totalRateINR <= 10000).length },
        { value: '10000$20000', min: 10000, max: 20000, count: rows.filter((hotel) => hotel.totalRateINR > 10000 && hotel.totalRateINR <= 20000).length },
        { value: '20000$', min: 20000, max: null, count: rows.filter((hotel) => hotel.totalRateINR > 20000).length },
      ],
    },
  };
}

function hotelDetail(id) {
  const hotel = hotels.find((item) => String(item.tjHotelId) === String(id)) || hotels[0];
  return {
    ...hotel,
    hotel: { ...hotel },
    results: [{ ...hotel }],
    staticContent: {
      name: hotel.name,
      rating: hotel.starRating,
      coordinates: { latitude: hotel.latitude, longitude: hotel.longitude },
      address: { line1: hotel.regionName, city: hotel.city, country: hotel.city === 'Singapore' ? 'Singapore' : 'India' },
      facilities: hotel.amenities,
      images: hotel.images || [],
    },
    options: [{ id: `${hotel.tjHotelId}-room-1`, roomName: 'Corporate Deluxe Room', mealBasis: hotel.mealBasis, totalRateINR: hotel.totalRateINR, cancellationPolicy: 'Free cancellation until 24 hours before check-in' }],
  };
}

function flightOptions(config) {
  const route = bodyFrom(config).searchQuery?.routeInfos?.[0] || {};
  const from = route.fromCityOrAirport?.code || 'PNQ';
  const to = route.toCityOrAirport?.code || 'BLR';
  const travelDate = route.travelDate || new Date().toISOString().slice(0, 10);
  return {
    search_id: `FS-${Date.now()}`,
    options: [
      { result_index: 'AI-101', total_fare: 8430, airline: 'Air India', flight_number: 'AI 852', cabin_class: 'ECONOMY', stops: 0, is_refundable: true, __route: { from, to, travelDate } },
      { result_index: '6E-220', total_fare: 7180, airline: 'IndiGo', flight_number: '6E 6814', cabin_class: 'ECONOMY', stops: 0, is_refundable: false, __route: { from, to, travelDate } },
      { result_index: 'UK-604', total_fare: 10240, airline: 'Vistara', flight_number: 'UK 604', cabin_class: 'ECONOMY', stops: 1, is_refundable: true, __route: { from, to, travelDate } },
    ],
  };
}

function bookingDetails(bookingId, kind) {
  const booking = kind === 'hotel' ? mockState.hotelBookings.get(bookingId) : mockState.flightBookings.get(bookingId);
  return booking || {
    status: { success: true, message: 'CONFIRMED' },
    bookingId,
    bookingInfos: [{ bookingId, status: 'CONFIRMED' }],
  };
}

export async function demoAdapter(config) {
  await sleep();
  const method = String(config.method || 'get').toUpperCase();
  const path = parsePath(config.url);
  const params = paramsFrom(config);
  const body = bodyFrom(config);

  if (method === 'GET' && path === '/auth/login-tenants') return response(config, { items: mockState.tenants });
  if (method === 'POST' && path === '/auth/login') {
    const user = currentUserForEmail(body.email);
    return response(config, { user, accessToken: `demo-access-${user.id}`, refreshToken: `demo-refresh-${user.id}` });
  }
  if (method === 'POST' && path === '/auth/register-company') {
    const user = { id: `USR-${Date.now()}`, fullName: body.admin_name, email: body.admin_email, employeeId: null, roles: ['Company Admin'], emailVerified: false, status: 'Active' };
    mockState.users.push(user);
    return response(config, { user, accessToken: `demo-access-${user.id}`, refreshToken: `demo-refresh-${user.id}`, verificationToken: 'demo-verification-token' }, 201);
  }
  if (path.startsWith('/auth/') && method === 'POST') return response(config, { message: 'Demo action completed', accessToken: 'demo-access-refresh', refreshToken: 'demo-refresh-refresh' });
  if (method === 'GET' && path === '/auth/users') return response(config, list(mockState.users, params));
  if (method === 'POST' && path === '/auth/invitations') {
    const employee = mockState.employees.find((item) => item.id === body.employee_id);
    const user = { id: `USR-${Date.now()}`, fullName: employee?.name || body.email, email: body.email, employeeId: body.employee_id, roles: body.roles || ['Employee'], emailVerified: false, status: 'Invited' };
    mockState.users.push(user);
    return response(config, { ...user, activationToken: `demo-activation-${user.id}` }, 201);
  }

  if (method === 'GET' && path === '/dashboard/summary') return response(config, dashboardSummary());
  if (method === 'GET' && path === '/reports/dashboard') return response(config, dashboardSummary());

  if (method === 'GET' && path === '/employees') {
    let rows = filterText(mockState.employees, params.search, ['id', 'name', 'email']);
    ['unit', 'grade', 'department'].forEach((key) => {
      if (params[key]) rows = rows.filter((row) => String(row[key]).toLowerCase().includes(String(params[key]).toLowerCase()));
    });
    const result = list(rows, params);
    result.data = clone(rows.map(employeeLegacy));
    return response(config, result);
  }
  if (method === 'GET' && path.startsWith('/employees/')) return response(config, mockState.employees.find((item) => item.id === decodeURIComponent(path.split('/')[2])) || mockState.employees[0]);
  if (method === 'POST' && path === '/employees') {
    const employee = { ...body, id: `EMP-${1000 + mockState.employees.length + 1}` };
    mockState.employees.push(employee);
    return response(config, employee, 201);
  }
  if (method === 'PUT' && path.startsWith('/employees/')) {
    const id = decodeURIComponent(path.split('/')[2]);
    mockState.employees = mockState.employees.map((item) => (item.id === id ? { ...item, ...body, id } : item));
    return response(config, mockState.employees.find((item) => item.id === id));
  }
  if (path.includes('/template/download')) return response(config, new Blob(['Demo template file'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  if (path.endsWith('/upload')) return response(config, { processed: 12, failed: 0, errors: [] });

  if (method === 'GET' && path === '/teams') return response(config, list(mockState.teams, params));
  if (method === 'POST' && path === '/teams') {
    const team = { ...body, id: `TEAM-${String(body.name || 'NEW').toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 16)}`, member_count: 0 };
    mockState.teams.push(team);
    return response(config, team, 201);
  }
  if (method === 'GET' && path === '/designations') return response(config, list(mockState.designations.filter((item) => !params.status || item.status === params.status), params));
  if (method === 'POST' && path === '/designations') {
    mockState.designations.push(body);
    return response(config, body, 201);
  }
  if (method === 'GET' && path === '/hierarchy') return response(config, { reporting_tree: hierarchyTree(), orphaned_manager_references: [] });

  if (method === 'GET' && path === '/grade-policies') return response(config, list(mockState.gradePolicies, params));
  if (method === 'GET' && path.startsWith('/grade-policies/')) return response(config, mockState.gradePolicies.find((item) => item.grade === decodeURIComponent(path.split('/')[2])) || mockState.gradePolicies[0]);
  if (method === 'POST' && path === '/grade-policies') {
    mockState.gradePolicies.push(body);
    return response(config, body, 201);
  }
  if (method === 'PUT' && path.startsWith('/grade-policies/')) {
    const grade = decodeURIComponent(path.split('/')[2]);
    mockState.gradePolicies = mockState.gradePolicies.map((item) => (item.grade === grade ? { ...item, ...body, grade } : item));
    return response(config, mockState.gradePolicies.find((item) => item.grade === grade));
  }
  if (method === 'DELETE' && path.startsWith('/grade-policies/')) {
    const grade = decodeURIComponent(path.split('/')[2]);
    mockState.gradePolicies = mockState.gradePolicies.filter((item) => item.grade !== grade);
    return response(config, { message: 'Grade policy deleted', grade });
  }

  if (method === 'GET' && path === '/budgets/summary') return response(config, dashboardSummary().budgets);
  if (method === 'GET' && path === '/budgets') return response(config, list(mockState.budgets, params));
  if (method === 'POST' && path === '/budgets') {
    const allocated = Number(body.allocated_amount || 0);
    const budget = { ...body, id: `BUD-${Date.now()}`, reserved_amount: 0, consumed_amount: 0, remaining_amount: allocated };
    mockState.budgets.push(budget);
    return response(config, budget, 201);
  }

  if (method === 'GET' && path === '/trips/options') return response(config, { employees: mockState.employees, budgets: mockState.budgets });
  if (method === 'GET' && path === '/trips') {
    const result = list(mockState.trips, params);
    result.data = clone(mockState.trips.map(tripLegacy));
    return response(config, result);
  }
  if (method === 'GET' && path.startsWith('/trips/') && path.endsWith('/approvals')) {
    const id = path.split('/')[2];
    return response(config, list(mockState.approvals.filter((approval) => approval.trip_id === id), params));
  }
  if (method === 'GET' && path.startsWith('/trips/')) {
    const id = decodeURIComponent(path.split('/')[2]);
    const trip = mockState.trips.find((item) => item.id === id) || mockState.trips[0];
    return response(config, path.includes('/trips/') ? trip : tripLegacy(trip));
  }
  if (method === 'POST' && path === '/trips') {
    const trip = { ...body, id: `TRIP-${new Date().getFullYear().toString().slice(2)}${String(mockState.trips.length + 1).padStart(4, '0')}`, status: 'Draft', policy_exception: false, budget_exception: false };
    mockState.trips.push(trip);
    mockState.approvals.push({ id: `APR-${Date.now()}`, trip_id: trip.id, stage: 'Manager', approver_employee_id: 'EMP-1005', status: 'Pending', comments: '' });
    return response(config, trip, 201);
  }
  if (method === 'PUT' && path.startsWith('/trips/')) {
    const id = path.split('/')[2];
    mockState.trips = mockState.trips.map((trip) => (trip.id === id ? { ...trip, ...body } : trip));
    return response(config, mockState.trips.find((trip) => trip.id === id));
  }
  if (method === 'POST' && path.match(/^\/trips\/[^/]+\/(submit|decision|travel-desk)$/)) {
    const [, , id, action] = path.split('/');
    const trip = mockState.trips.find((item) => item.id === id);
    if (trip) trip.status = action === 'submit' ? 'Pending Approval' : action === 'decision' ? (body.decision === 'Reject' ? 'Rejected' : 'Approved') : body.status || trip.status;
    return response(config, trip || {});
  }
  if (method === 'POST' && path === '/approvals/act') return response(config, { message: 'Approval action recorded' });

  if (method === 'GET' && path === '/trip-components') return response(config, list(mockState.tripComponents.filter((item) => !params.trip_id || item.trip_id === params.trip_id), params));
  if (method === 'POST' && path === '/trip-components') {
    const component = { ...body, id: `CMP-${Date.now()}`, status: 'Requested' };
    mockState.tripComponents.push(component);
    return response(config, component, 201);
  }
  if (method === 'PUT' && path.startsWith('/trip-components/')) {
    const id = path.split('/')[2];
    mockState.tripComponents = mockState.tripComponents.map((item) => (item.id === id ? { ...item, ...body } : item));
    return response(config, mockState.tripComponents.find((item) => item.id === id));
  }

  if (method === 'GET' && path === '/visas') return response(config, list(mockState.visas, params));
  if (method === 'POST' && path === '/visas') {
    const visa = { ...body, id: `VISA-${Date.now()}`, status: 'Documents Pending' };
    mockState.visas.push(visa);
    return response(config, visa, 201);
  }
  if (method === 'PUT' && path.startsWith('/visas/')) {
    const id = path.split('/')[2];
    mockState.visas = mockState.visas.map((visa) => (visa.id === id ? { ...visa, ...body } : visa));
    return response(config, mockState.visas.find((visa) => visa.id === id));
  }

  if (method === 'GET' && path === '/v1/flights/airports') return response(config, { results: filterText(airports, params.query, ['code', 'city', 'name', 'country']).slice(0, Number(params.limit || 10)) });
  if (method === 'GET' && path === '/flights/airlines') return response(config, { results: filterText(airlines, params.search, ['code', 'name']).slice(0, Number(params.limit || 10)) });
  if (method === 'POST' && path === '/v1/search') return response(config, flightOptions(config));
  if (method === 'POST' && path === '/flights/book') {
    const bookingId = `64f${Date.now().toString(16).padStart(21, '0').slice(0, 21)}`;
    const details = { bookingId, status: { success: true, message: 'CONFIRMED' }, bookingInfos: [{ bookingId, status: 'CONFIRMED', sI: [] }] };
    mockState.flightBookings.set(bookingId, details);
    return response(config, details, 201);
  }
  if (method === 'POST' && path === '/payments/order') return response(config, { orderId: `order_demo_${Date.now()}`, keyId: 'rzp_test_demo', amount: 1012400, currency: 'INR' });
  if (method === 'POST' && path === '/payments/verify') return response(config, { verified: true });
  if (method === 'POST' && path === '/flights/booking-details') return response(config, bookingDetails(body.bookingId, 'flight'));
  if (method === 'POST' && path === '/flights/ticket') return response(config, { bookingId: body.bookingId, status: 'TICKETED' });
  if (method === 'POST' && path === '/flights/cancel') return response(config, { bookingId: body.bookingId, status: 'CANCELLED' });

  if (method === 'GET' && path === '/cities/autocomplete') {
    const rows = filterText(hotelCities, params.q, ['name', 'displayName', 'regionName', 'countryName', 'fullRegionName']);
    return response(config, { results: rows.slice(0, Number(params.limit || 10)) });
  }
  if (method === 'GET' && path === '/countries') return response(config, { results: countries, items: countries });
  if (method === 'POST' && path === '/hotels/listing') return response(config, hotelListing(config));
  if (method === 'POST' && path === '/hotels/listing/filter') return response(config, hotelFilters(config));
  if (method === 'POST' && path === '/hotels/hotel-details/static') return response(config, hotelDetail(body.tjHotelId));
  if (method === 'POST' && path === '/hotels/hotel-details/static/map') return response(config, { results: (body.tjHotelIds || []).map(hotelDetail) });
  if (method === 'POST' && path === '/hotels/hotel-details') return response(config, hotelDetail(body.tjHotelId || body.hotelId));
  if (method === 'POST' && path === '/hotels/review') return response(config, { reviewId: `HREV-${Date.now()}`, hotel: hotelDetail(body.tjHotelId || body.hotelId), price: { totalRateINR: 24500, currency: 'INR' } });
  if (method === 'POST' && path === '/hotels/booking-details') return response(config, bookingDetails(body.bookingId || 'HOTEL-DEMO-001', 'hotel'));
  if (method === 'POST' && path === '/hotels/cancel') return response(config, { bookingId: body.bookingId, status: 'CANCELLED' });

  return response(config, { message: `Demo mock response for ${method} ${path}`, items: [], data: [] });
}
