import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, PlusCircle, RefreshCw, XCircle } from 'lucide-react';
import api from '../../api';
import {
  extractBookingRecord,
  extractHotelBookingFare,
  getNestedField,
  loadHotelBookingSnapshot,
} from './hotelTripjackHelpers';
import { updateHotelBookingStatus } from './hotelUserHistory';

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
  }
  return 'CONFIRMED';
}

function parseDateText(raw) {
  if (!raw) return '--';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function nightsBetween(checkin, checkout) {
  const start = new Date(checkin);
  const end = new Date(checkout);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  return Math.max(1, Math.round((end - start) / 86400000));
}

export default function HotelConfirm() {
  const [params] = useSearchParams();
  const bookingId = params.get('bookingId') || '';
  const qc = useQueryClient();
  const snapshot = useMemo(() => loadHotelBookingSnapshot(bookingId), [bookingId]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hotelBooking', bookingId],
    queryFn: () => api.post('/hotels/booking-details', { bookingId }).then((r) => r.data),
    enabled: Boolean(bookingId),
  });

  const cancel = useMutation({
    mutationFn: () => api.post('/hotels/cancel', { bookingId, remarks: 'User cancelled' }).then((r) => r.data),
    onSuccess: () => {
      updateHotelBookingStatus(bookingId, 'Cancelled');
      qc.invalidateQueries({ queryKey: ['hotelBooking', bookingId] });
    },
  });

  const record = extractBookingRecord(data);
  const fare = useMemo(() => extractHotelBookingFare(data, snapshot), [data, snapshot]);
  const {
    totalPayable,
    baseFare,
    taxesAndFees,
    managementFees,
    managementFeesTax,
  } = fare;

  const status = toStatusText(record?.status || data?.status);
  const isCancelled = status === 'CANCELLED';
  const hotelName = getNestedField(record, ['hotelName', 'hotel.name', 'hInfo.name'], snapshot?.hotelName || 'Hotel');
  const address = getNestedField(
    record,
    ['hotelAddress', 'hotel.address', 'hInfo.ad.adr', 'address.fullAddress'],
    snapshot?.address || '',
  );
  const cityState = getNestedField(
    record,
    ['hotelCityState', 'hotel.cityState', 'address.cityName'],
    [snapshot?.city, snapshot?.postalCode ? `Postal Code: ${snapshot.postalCode}` : ''].filter(Boolean).join(', '),
  );
  const roomName = getNestedField(record, ['roomName', 'roomType', 'rooms.0.name'], snapshot?.selectedRoom?.name || 'Room');
  const board = getNestedField(
    record,
    ['boardBasis', 'rooms.0.boardBasis', 'rooms.0.mealBasis'],
    snapshot?.selectedRoom?.boardBasis || snapshot?.selectedRoom?.mealBasis || 'Room Only',
  );
  const guestName = getNestedField(
    record,
    ['leadGuestName', 'guestName', 'travellerInfo.0.fN', 'guests.0.name'],
    snapshot?.leadGuestName || '',
  );
  const contactEmail = getNestedField(
    record,
    ['contact.email', 'deliveryInfo.emails.0'],
    snapshot?.contact?.email || '',
  );
  const contactPhone = getNestedField(
    record,
    ['contact.phone', 'deliveryInfo.contacts.0'],
    snapshot?.contact?.phone || '',
  );
  const checkinRaw = getNestedField(record, ['checkin', 'checkIn', 'checkinDate'], snapshot?.checkin || '');
  const checkoutRaw = getNestedField(record, ['checkout', 'checkOut', 'checkoutDate'], snapshot?.checkout || '');
  const checkin = parseDateText(checkinRaw);
  const checkout = parseDateText(checkoutRaw);
  const roomsCount = Number(getNestedField(record, ['roomsCount', 'rooms.length'], snapshot?.totalRooms || 1));
  const guestsCount = Number(getNestedField(record, ['guestsCount', 'travellerInfo.length'], snapshot?.totalGuests || 1));
  const nights = nightsBetween(checkinRaw, checkoutRaw);
  const starCount = Number(getNestedField(record, ['starRating', 'hotel.starRating'], snapshot?.starCount || 0));
  const cancellationAmount = totalPayable > 0 ? totalPayable : 0;

  if (!bookingId) {
    return (
      <div className="bg-[#f4f4f4] min-h-[calc(100vh-6.25rem)] flex items-center justify-center">
        <div className="rounded border border-slate-200 bg-white px-6 py-8 text-center text-slate-600">
          Missing booking ID. Please complete a hotel booking first.
          <div className="mt-4">
            <Link to="/hotels" className="text-[#ff7f2a] font-semibold hover:underline">Back to search</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f4f4f4] min-h-[calc(100vh-6.25rem)]">
      <div className="max-w-[1320px] mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_430px] gap-0 border border-[#d7d7d7] bg-white">
          <div className="border-r border-[#d7d7d7]">
            <div className="bg-[#eef5fb] border-b border-[#d7d7d7] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  {isCancelled ? (
                    <XCircle className="h-11 w-11 text-rose-500 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-11 w-11 text-[#49a010] mt-0.5" />
                  )}
                  <div>
                    <div className={`text-[36px] font-semibold ${isCancelled ? 'text-rose-600' : 'text-[#48a011]'}`}>
                      {isCancelled ? 'Booking Cancelled' : 'Booking Payment Success'}
                    </div>
                    <div className="text-[15px] text-[#506174]">
                      Booking ID: <span className="font-semibold underline">{bookingId}</span>
                    </div>
                    <div className="text-[13px] text-slate-500">Status: {status}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                  </button>
                  <Link
                    to={`/hotels/invoice?bookingId=${encodeURIComponent(bookingId)}`}
                    className="rounded bg-[#ff7f2a] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#eb6f1d]"
                  >
                    Print Invoice
                  </Link>
                </div>
              </div>
            </div>

            <div className="px-4 py-4">
              <div className="text-[28px] font-semibold text-[#2b3a4a]">
                {hotelName}
                {starCount > 0 ? (
                  <span className="text-[#f28522]">
                    {' '}
                    {Array.from({ length: starCount }).map(() => '*').join('')}
                  </span>
                ) : null}
              </div>
              {address ? <div className="text-[14px] text-[#677889]">{address}</div> : null}
              {cityState ? <div className="text-[14px] text-[#677889]">{cityState}</div> : null}

              <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-0 rounded border border-[#d8d8d8] overflow-hidden">
                <InfoTile title="Check in" value={checkin} sub="3:00 PM" />
                <InfoTile title="Check out" value={checkout} sub="12:00 PM" />
                <InfoTile title="Total Rooms" value={String(roomsCount)} />
                <InfoTile title="Total Guests" value={`${guestsCount} Adult${guestsCount > 1 ? 's' : ''}`} />
                <InfoTile title="Total Stay" value={`${nights} Night(s)`} />
              </div>

              <div className="mt-3 rounded border border-[#d8d8d8] px-3 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[14px]">
                  <div className="font-semibold text-[#2f3e4f]">{roomName}</div>
                  <div className="text-[#5f6f80]">Incl : {board}</div>
                  <div className="text-[#5f6f80]">
                    <div className="font-semibold">Total Guest: {guestsCount} Adult{guestsCount > 1 ? 's' : ''}</div>
                    {guestName ? <div>Name : {guestName}</div> : null}
                  </div>
                </div>
              </div>

              <Section title="Special request(s)">
                <button type="button" className="inline-flex items-center gap-1 text-[14px] font-semibold text-[#ff7f2a]">
                  <PlusCircle className="h-4 w-4" /> Add New
                </button>
              </Section>

              <Section title="Contact Details">
                <div className="text-[14px] text-[#5d6d7f]">
                  {contactEmail ? <div>Email : {contactEmail}</div> : null}
                  {contactPhone ? <div>Mobile : {contactPhone}</div> : null}
                </div>
              </Section>

              <Section title="Cancellation Policy">
                <div className="overflow-x-auto rounded border border-[#d8d8d8]">
                  <table className="w-full text-[14px]">
                    <thead className="bg-[#f3f5f7] text-[#314052]">
                      <tr>
                        <th className="border-r border-[#d8d8d8] px-3 py-2 text-left">Cancellation on or After</th>
                        <th className="border-r border-[#d8d8d8] px-3 py-2 text-left">Cancellation on or Before</th>
                        <th className="px-3 py-2 text-left">Cancellation Charges/Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border-r border-t border-[#d8d8d8] px-3 py-2">{checkin}</td>
                        <td className="border-r border-t border-[#d8d8d8] px-3 py-2">{checkout}</td>
                        <td className="border-t border-[#d8d8d8] px-3 py-2">{fmtINR(cancellationAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 space-y-1 text-[14px] text-[#495a6c]">
                  <div>*Each booking is applicable of Rs.20 per room per night non-refundable service fees.</div>
                  <div>*No Show will attract full cancellation charge unless otherwise specified.</div>
                  <div>*Early check out will attract full cancellation charge unless otherwise specified.</div>
                  <div>*Please note that redeemed Taxes-fees are non-refundable.</div>
                </div>
              </Section>

              <Section title="Booking Notes">
                <div className="space-y-3 text-[14px] leading-6 text-[#4e5f71]">
                  <p>
                    Reservations are required for massage services and spa treatments. Confirm details with hotel before arrival.
                    Guests can contact property for check-in instructions and transport support.
                  </p>
                  <p>
                    Optional fees include breakfast, shuttle, pet fee, and valet fee as per availability and property policy.
                    Fees and deposits may not include tax and are subject to change.
                  </p>
                </div>
              </Section>

              <Section title="General Terms & Conditions">
                <ol className="list-decimal pl-5 text-[14px] leading-7 text-[#5b6c7f]">
                  <li>Your booking is confirmed. Guest photo ID must be presented at check-in.</li>
                  <li>Extra charges at hotel are payable by guest directly before departure.</li>
                  <li>Special requests are subject to availability at the time of check-in.</li>
                  <li>City tax or resort fee (if any) are to be paid directly to hotel.</li>
                  <li>Full cancellation charges are applicable on early check-out unless otherwise specified.</li>
                </ol>
              </Section>

              <div className="mt-5 flex flex-wrap gap-2">
                {!isCancelled ? (
                  <button
                    onClick={() => cancel.mutate()}
                    disabled={cancel.isPending}
                    className="rounded border border-rose-300 px-4 py-2 text-[13px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    {cancel.isPending ? 'Cancelling...' : 'Cancel booking'}
                  </button>
                ) : null}
                <Link to="/hotels" className="rounded border border-slate-300 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
                  Back to search
                </Link>
              </div>
            </div>
          </div>

          <aside className="bg-[#f8f8f8] px-3 py-4">
            <div className="text-[15px] font-semibold uppercase tracking-wide text-[#7a8797]">FARE SUMMARY</div>
            <div className="mt-3 space-y-3 text-[16px] text-[#2f3f51]">
              <Row label="Base Fare" value={fmtINR(baseFare)} />
              <Row label="Taxes and fees" value={fmtINR(taxesAndFees)} />
              {managementFees > 0 ? <Row label="Management Fees" value={fmtINR(managementFees)} /> : null}
              {managementFeesTax > 0 ? <Row label="Management Fees Tax" value={fmtINR(managementFeesTax)} /> : null}
              <Row label="Total Amount Payable" value={fmtINR(totalPayable)} bold />
            </div>
            {isLoading && !totalPayable ? (
              <div className="mt-4 text-[13px] text-slate-500">Loading live booking fare...</div>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ title, value, sub }) {
  return (
    <div className="border-r border-b border-[#d8d8d8] bg-[#eaf2fb] p-3 last:border-r-0 md:border-b-0">
      <div className="text-[13px] font-semibold text-[#4b6178]">{title}</div>
      <div className="text-[17px] font-bold text-[#27374a]">
        {value}
      </div>
      {sub ? <div className="text-[13px] text-[#5e6e80]">{sub}</div> : null}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-5 border-t border-[#e1e1e1] pt-4">
      <div className="mb-3 text-[17px] font-semibold text-[#2f3f51]">
        {title}
      </div>
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
