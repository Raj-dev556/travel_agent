import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plane, RefreshCw, Ticket, XCircle } from 'lucide-react';
import api from '../../api';
import { computeFare, hydrateFromQuery, ITINERARY_SEGMENTS } from './flightFlowData';
import { useAuthStore } from '../../store/auth';

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

function toStatusText(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    if (typeof value.status === 'string' && value.status.trim()) return value.status.trim();
    if (typeof value.message === 'string' && value.message.trim()) return value.message.trim();
    if (typeof value.httpStatus === 'number') return `HTTP_${value.httpStatus}`;
    return 'UNKNOWN';
  }
  return 'CONFIRMED';
}

function valueFrom(obj, paths, fallback = '') {
  for (const path of paths) {
    const parts = String(path).split('.');
    let cur = obj;
    let found = true;
    for (const part of parts) {
      if (!cur || !(part in cur)) {
        found = false;
        break;
      }
      cur = cur[part];
    }
    if (found && cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return fallback;
}

function fmtDate(raw) {
  if (!raw) return '--';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtClock(raw) {
  if (!raw) return '--:--';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function minutesDiff(fromIso, toIso) {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.round((to - from) / 60000));
}

function fmtDuration(mins) {
  const safe = Math.max(0, Number(mins || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m}m`;
}

function normalizeSegments(details) {
  const apiSegments =
    valueFrom(details, ['bookingInfos.0.sI', 'segments', 'booking.segments'], null) || [];

  if (Array.isArray(apiSegments) && apiSegments.length) {
    return apiSegments.map((seg, idx) => {
      const depIso = valueFrom(seg, ['departureTime', 'dt'], '');
      const arrIso = valueFrom(seg, ['arrivalTime', 'at'], '');
      const airline = valueFrom(seg, ['airline', 'fD.aI.name'], 'Airline');
      const flightNo = valueFrom(seg, ['flightNumber', 'fD.fN'], `FL-${idx + 1}`);
      const from = valueFrom(seg, ['from', 'da.code'], '--');
      const to = valueFrom(seg, ['to', 'aa.code'], '--');
      const stops = Number(valueFrom(seg, ['stops', 'stopCount'], 0));
      const durationMinutes = Number(valueFrom(seg, ['durationMinutes'], 0)) || minutesDiff(depIso, arrIso);

      return {
        id: `${flightNo}-${idx}`,
        airline,
        flightNo,
        from,
        to,
        depIso,
        arrIso,
        depLabel: depIso ? `${fmtDate(depIso)} ${fmtClock(depIso)}` : valueFrom(seg, ['depDateTime'], '--'),
        arrLabel: arrIso ? `${fmtDate(arrIso)} ${fmtClock(arrIso)}` : valueFrom(seg, ['arrDateTime'], '--'),
        duration: durationMinutes ? fmtDuration(durationMinutes) : valueFrom(seg, ['duration'], '--'),
        stopsText: stops > 0 ? `${stops} Stop` : 'Non-Stop',
      };
    });
  }

  return ITINERARY_SEGMENTS.map((seg, idx) => ({
    id: `${seg.flightNo}-${idx}`,
    airline: seg.airline,
    flightNo: seg.flightNo,
    from: seg.depCity?.split(',')?.[0] || '--',
    to: seg.arrCity?.split(',')?.[0] || '--',
    depIso: '',
    arrIso: '',
    depLabel: seg.depDateTime,
    arrLabel: seg.arrDateTime,
    duration: seg.duration,
    stopsText: 'Non-Stop',
  }));
}

export default function FlightConfirm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const bookingId = params.get('bookingId') || `STUB-${Date.now()}`;
  const accessToken = useAuthStore((state) => state.accessToken);
  const qc = useQueryClient();

  const draft = useMemo(() => hydrateFromQuery(params), [params]);
  const fare = useMemo(() => computeFare(draft.amount), [draft.amount]);

  const isStubBooking = /^STUB-|^TJS/i.test(String(bookingId || ''));
  const canFetchLiveDetails = Boolean(bookingId) && !isStubBooking && Boolean(accessToken);

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ['flightBooking', bookingId],
    queryFn: () => api.post('/flights/booking-details', { bookingId }).then((r) => r.data),
    enabled: canFetchLiveDetails,
    retry: (failureCount, err) => {
      const statusCode = err?.response?.status;
      if (statusCode === 401 || statusCode === 403) return false;
      return failureCount < 2;
    },
  });

  const ticket = useMutation({
    mutationFn: () => api.post('/flights/ticket', { bookingId }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flightBooking', bookingId] }),
    onError: (err) => {
      if (err?.response?.status === 401) navigate('/login');
    },
  });

  const cancel = useMutation({
    mutationFn: () => api.post('/flights/cancel', { bookingId, remarks: 'User cancelled' }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flightBooking', bookingId] }),
    onError: (err) => {
      if (err?.response?.status === 401) navigate('/login');
    },
  });

  useEffect(() => {
    if (error?.response?.status === 401) navigate('/login');
  }, [error, navigate]);

  const apiReported403 =
    Number(data?.status?.httpStatus) === 403 ||
    Number(error?.response?.status) === 403 ||
    (Array.isArray(data?.errors) && data.errors.some((item) => String(item?.errCode || '').trim() === '403'));

  const shouldUseFallbackDetails = !canFetchLiveDetails || apiReported403 || data?.status?.success === false || !data;
  const details = shouldUseFallbackDetails
    ? {
        status: {
          success: true,
          message: 'Payment completed. Live booking sync pending.',
          source: 'client-fallback',
        },
      }
    : data;

  const status = toStatusText(details?.status || details?.bookingInfos?.[0]?.status || 'CONFIRMED');
  const isTicketed = status === 'TICKETED' || status === 'CONFIRMED';
  const isCancelled = status === 'CANCELLED';
  const showLiveActions = !shouldUseFallbackDetails;

  const segments = useMemo(() => normalizeSegments(details), [details]);
  const firstSeg = segments[0] || {};
  const lastSeg = segments[segments.length - 1] || firstSeg;

  const routeTitle = `${firstSeg.from || 'Origin'} -> ${lastSeg.to || 'Destination'}`;
  const travelDate = firstSeg.depIso ? fmtDate(firstSeg.depIso) : String(firstSeg.depLabel || '--');
  const travellers = Number(draft?.travellers?.length || 1);
  const contactEmail = draft?.contact?.email || 'Not available';
  const contactPhone = draft?.contact?.phone || 'Not available';

  return (
    <div className="min-h-[calc(100vh-6.25rem)] bg-[#f4f4f4]">
      <div className="mx-auto max-w-[1320px] px-4 py-6">
        <div className="grid grid-cols-1 gap-0 border border-[#d7d7d7] bg-white lg:grid-cols-[1fr_420px]">
          <div className="border-r border-[#d7d7d7]">
            <div className="border-b border-[#d7d7d7] bg-[#eef5fb] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  {isCancelled ? (
                    <XCircle className="mt-0.5 h-11 w-11 text-rose-500" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-11 w-11 text-[#49a010]" />
                  )}
                  <div>
                    <div className={`text-[34px] font-semibold ${isCancelled ? 'text-rose-600' : 'text-[#48a011]'}`}>
                      {isCancelled ? 'Booking Cancelled' : 'Booking Payment Success'}
                    </div>
                    <div className="text-[15px] text-[#506174]">
                      Booking ID: <span className="font-semibold underline">{bookingId}</span>
                    </div>
                    <div className="text-[13px] text-slate-500">Status: {status}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {canFetchLiveDetails ? (
                    <button
                      type="button"
                      onClick={() => refetch()}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </button>
                  ) : null}
                  <Link
                    to="/flights"
                    className="rounded bg-[#ff7f2a] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#eb6f1d]"
                  >
                    New Search
                  </Link>
                </div>
              </div>
            </div>

            <div className="px-4 py-4">
              <div className="text-[28px] font-semibold text-[#2b3a4a]">{routeTitle}</div>
              <div className="text-[14px] text-[#677889]">Travel date: {travelDate}</div>

              <div className="mt-4 grid grid-cols-2 gap-0 overflow-hidden rounded border border-[#d8d8d8] md:grid-cols-5">
                <InfoTile title="From" value={firstSeg.from || '--'} sub={firstSeg.depIso ? fmtClock(firstSeg.depIso) : ''} />
                <InfoTile title="To" value={lastSeg.to || '--'} sub={lastSeg.arrIso ? fmtClock(lastSeg.arrIso) : ''} />
                <InfoTile title="Trip Type" value={segments.length > 1 ? 'Connecting' : 'Direct'} />
                <InfoTile title="Passengers" value={`${travellers} Adult${travellers > 1 ? 's' : ''}`} />
                <InfoTile title="Cabin" value={draft?.cabinClass || 'Economy'} />
              </div>

              <Section title="Flight Segment Details">
                <div className="overflow-x-auto rounded border border-[#d8d8d8]">
                  <table className="w-full text-[14px]">
                    <thead className="bg-[#f3f5f7] text-[#314052]">
                      <tr>
                        <th className="border-r border-[#d8d8d8] px-3 py-2 text-left">Airline / Flight</th>
                        <th className="border-r border-[#d8d8d8] px-3 py-2 text-left">Departure</th>
                        <th className="border-r border-[#d8d8d8] px-3 py-2 text-left">Arrival</th>
                        <th className="border-r border-[#d8d8d8] px-3 py-2 text-left">Duration</th>
                        <th className="px-3 py-2 text-left">Stops</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segments.map((seg) => (
                        <tr key={seg.id}>
                          <td className="border-r border-t border-[#d8d8d8] px-3 py-2">
                            <div className="font-semibold text-[#2f3e4f]">{seg.airline}</div>
                            <div className="text-[#5f6f80]">{seg.flightNo}</div>
                          </td>
                          <td className="border-r border-t border-[#d8d8d8] px-3 py-2">{seg.depLabel}</td>
                          <td className="border-r border-t border-[#d8d8d8] px-3 py-2">{seg.arrLabel}</td>
                          <td className="border-r border-t border-[#d8d8d8] px-3 py-2">{seg.duration}</td>
                          <td className="border-t border-[#d8d8d8] px-3 py-2">{seg.stopsText}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section title="Contact Details">
                <div className="text-[14px] text-[#5d6d7f]">
                  <div>Email : {contactEmail}</div>
                  <div>Mobile : {contactPhone}</div>
                </div>
              </Section>

              <Section title="Booking Notes">
                <div className="space-y-2 text-[14px] leading-6 text-[#4e5f71]">
                  <p>Keep a valid photo ID for all passengers during airport check-in.</p>
                  <p>Baggage allowance and meal inclusion depend on selected fare and airline policy.</p>
                  <p>For support, use Manage Bookings with your Booking ID.</p>
                </div>
              </Section>

              <Section title="General Terms & Conditions">
                <ol className="list-decimal pl-5 text-[14px] leading-7 text-[#5b6c7f]">
                  <li>Tickets are non-transferable and valid only for named passengers.</li>
                  <li>Airline schedule changes are governed by airline policy.</li>
                  <li>Cancellation and reschedule charges apply as per fare rules.</li>
                  <li>Refund timelines depend on payment mode and airline confirmation.</li>
                </ol>
              </Section>

              {shouldUseFallbackDetails ? (
                <div className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                  Live booking details are temporarily unavailable. Showing payment-confirmed booking summary.
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                {showLiveActions && !isTicketed && !isCancelled ? (
                  <button
                    type="button"
                    onClick={() => ticket.mutate()}
                    disabled={ticket.isPending}
                    className="inline-flex items-center gap-1 rounded bg-[#ff7f2a] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#eb6f1d] disabled:opacity-50"
                  >
                    <Ticket className="h-4 w-4" /> {ticket.isPending ? 'Issuing...' : 'Issue ticket'}
                  </button>
                ) : null}

                {showLiveActions && !isCancelled ? (
                  <button
                    type="button"
                    onClick={() => cancel.mutate()}
                    disabled={cancel.isPending}
                    className="rounded border border-rose-300 px-4 py-2 text-[13px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    {cancel.isPending ? 'Cancelling...' : 'Cancel booking'}
                  </button>
                ) : null}

                <Link
                  to="/flights"
                  className="rounded border border-slate-300 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Back to search
                </Link>
              </div>
            </div>
          </div>

          <aside className="bg-[#f8f8f8] px-3 py-4">
            <div className="text-[15px] font-semibold uppercase tracking-wide text-[#7a8797]">FARE SUMMARY</div>
            <div className="mt-3 space-y-3 text-[16px] text-[#2f3f51]">
              <Row label="Base Fare" value={fmtINR(fare.baseFare)} />
              <Row label="Taxes and Fees" value={fmtINR(fare.taxes)} />
              <Row label="Total Amount Payable" value={fmtINR(fare.total)} bold />
            </div>
            {isLoading ? <div className="mt-4 text-[13px] text-slate-500">Loading booking details...</div> : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ title, value, sub }) {
  return (
    <div className="border-b border-r border-[#d8d8d8] bg-[#eaf2fb] p-3 last:border-r-0 md:border-b-0">
      <div className="text-[13px] font-semibold text-[#4b6178]">{title}</div>
      <div className="text-[17px] font-bold text-[#27374a]">{value}</div>
      {sub ? <div className="text-[13px] text-[#5e6e80]">{sub}</div> : null}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-5 border-t border-[#e1e1e1] pt-4">
      <div className="mb-3 text-[17px] font-semibold text-[#2f3f51]">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value, bold = false }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
