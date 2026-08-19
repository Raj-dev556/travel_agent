import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../api';
import {
  extractBookingRecord,
  extractHotelBookingFare,
  getNestedField,
  loadHotelBookingSnapshot,
} from './hotelTripjackHelpers';

const fmtAmount = (n) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

function parseDateText(raw) {
  if (!raw) return '--';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

function getField(data, keys, fallback = '') {
  return getNestedField(data, keys, fallback);
}

function nightsBetween(checkin, checkout) {
  const start = new Date(checkin);
  const end = new Date(checkout);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  return Math.max(1, Math.round((end - start) / 86400000));
}

export default function HotelInvoice() {
  const [params] = useSearchParams();
  const bookingId = params.get('bookingId') || '';
  const snapshot = useMemo(() => loadHotelBookingSnapshot(bookingId), [bookingId]);

  const { data } = useQuery({
    queryKey: ['hotelInvoiceBooking', bookingId],
    queryFn: () => api.post('/hotels/booking-details', { bookingId }).then((r) => r.data),
    enabled: Boolean(bookingId),
  });

  const record = extractBookingRecord(data);
  const fare = useMemo(() => extractHotelBookingFare(data, snapshot), [data, snapshot]);

  const hotelName = getField(record, ['hotelName', 'hotel.name', 'hInfo.name'], snapshot?.hotelName || 'Hotel');
  const roomName = getField(record, ['roomName', 'roomType', 'rooms.0.name'], snapshot?.selectedRoom?.name || 'Room');
  const guestName = getField(record, ['leadGuestName', 'guestName', 'travellerInfo.0.fN'], snapshot?.leadGuestName || '');
  const city = getField(record, ['hotelCity', 'hotel.city', 'hInfo.ad.city.name'], snapshot?.city || '');
  const checkinRaw = getField(record, ['checkin', 'checkIn', 'checkinDate'], snapshot?.checkin || '');
  const checkoutRaw = getField(record, ['checkout', 'checkOut', 'checkoutDate'], snapshot?.checkout || '');
  const checkin = parseDateText(checkinRaw);
  const checkout = parseDateText(checkoutRaw);
  const nights = nightsBetween(checkinRaw, checkoutRaw);

  const totalAmount = fare.totalPayable;
  const serviceCharges = fare.managementFees;
  const gst = fare.managementFeesTax + fare.taxes;
  const rate = fare.baseFare;
  const invoiceNo = `HS-${String(bookingId).slice(-5) || '23432'}`;
  const invoiceDate = parseDateText(new Date().toISOString());
  const cgst = Number((gst / 2).toFixed(2));
  const sgst = Number((gst / 2).toFixed(2));
  const igst = 0;

  const printLabel = useMemo(() => `Print Invoice`, []);

  return (
    <div className="bg-[#f4f4f4] min-h-[calc(100vh-6.25rem)] py-6">
      <div className="max-w-[1320px] mx-auto px-4">
        <div className="mb-2 flex justify-end">
          <button type="button" onClick={() => window.print()} className="rounded bg-[#ff7f2a] px-4 py-2 text-[17px] font-semibold text-white hover:bg-[#eb6f1d]">
            {printLabel}
          </button>
        </div>

        <div className="border border-[#d7d7d7] bg-white">
          <div className="grid grid-cols-2 border-b border-[#d7d7d7]">
            <div className="px-6 py-4">
              <img
                src="/TH-LOGO.png"
                alt="TripHobo"
                className="h-16 w-auto object-contain"
              />
            </div>
            <div className="px-6 py-4 text-right text-[13px] text-[#2e3e4f]">
              <div><strong>Invoice No.</strong> - {invoiceNo}</div>
              <div><strong>Invoice Date</strong> - {invoiceDate}</div>
              <div><strong>Confirmation No.</strong> -</div>
              <div><strong>Booking ID.</strong> - {bookingId}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 px-3 py-4 text-[14px]">
            <div>
              <div className="text-[17px] font-semibold text-[#1f2d3c]">
                Atlas
              </div>
              <div><strong>Regd Office:</strong> 53, Haji Mahal,Mohammed Ali Road MumbaiMumbai Maharashtra 400003</div>
              <div><strong>Email:</strong> info@atlastravels.com</div>
              <div><strong>Phone:</strong> 9250008101</div>
              <div><strong>State:</strong> Maharashtra</div>
              <div><strong>GST Number:</strong> 07AAGCT7826A1ZF</div>
            </div>

            <div className="text-center">
              <div className="text-[20px] font-semibold text-[#1f2d3c]">
                INVOICE
              </div>
            </div>

            <div className="text-right">
              <div className="text-[20px] font-semibold text-[#1f2d3c]">Joguru Technologies Pvt Ltd</div>
              <div><strong>Regd Office:</strong> Office No. C-206, Teerth Technospace, Opp. Mercedes Benz Showroom, Mumbai Bangalore Highway, Baner, Pune 411045, Maharashtra Pune 411045</div>
              <div><strong>Email:</strong> kunal.a@triphobo.com</div>
              <div><strong>Phone:</strong> 8329516613</div>
              <div><strong>State:</strong> Maharashtra</div>
            </div>
          </div>

          <div className="px-3 pb-4">
            <table className="w-full border border-[#d8d8d8] text-[14px]">
              <thead className="bg-[#f3f5f7] text-[#2e3f52]">
                <tr>
                  <th className="border-r border-[#d8d8d8] px-2 py-2 text-left">Hotel Name</th>
                  <th className="border-r border-[#d8d8d8] px-2 py-2 text-left">Room Type</th>
                  <th className="border-r border-[#d8d8d8] px-2 py-2 text-left">PAX Name</th>
                  <th className="border-r border-[#d8d8d8] px-2 py-2 text-left">Nights</th>
                  <th className="border-r border-[#d8d8d8] px-2 py-2 text-left">Rate</th>
                  <th className="border-r border-[#d8d8d8] px-2 py-2 text-left">GST</th>
                  <th className="px-2 py-2 text-left">Service Charges</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-[#2f3f52]">
                  <td className="border-r border-t border-[#d8d8d8] px-2 py-2">{hotelName}</td>
                  <td className="border-r border-t border-[#d8d8d8] px-2 py-2">{roomName}</td>
                  <td className="border-r border-t border-[#d8d8d8] px-2 py-2">{guestName}</td>
                  <td className="border-r border-t border-[#d8d8d8] px-2 py-2">{nights}</td>
                  <td className="border-r border-t border-[#d8d8d8] px-2 py-2">{fmtAmount(rate)}</td>
                  <td className="border-r border-t border-[#d8d8d8] px-2 py-2">{fmtAmount(gst)}</td>
                  <td className="border-t border-[#d8d8d8] px-2 py-2">{fmtAmount(serviceCharges)}</td>
                </tr>
                <tr className="bg-[#fafafa] text-[#2f3f52]">
                  <td colSpan={2} className="border-r border-t border-[#d8d8d8] px-2 py-2"><strong>City :</strong>{city}</td>
                  <td colSpan={2} className="border-r border-t border-[#d8d8d8] px-2 py-2"><strong>CheckIn :</strong> {checkin}</td>
                  <td colSpan={3} className="border-t border-[#d8d8d8] px-2 py-2"><strong>Check Out :</strong> {checkout}</td>
                </tr>
              </tbody>
            </table>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-3 mt-3">
              <table className="w-full border border-[#d8d8d8] text-[14px]">
                <thead className="bg-[#f3f5f7]">
                  <tr>
                    <th className="border-r border-[#d8d8d8] px-2 py-2 text-left">Add CGST @0%</th>
                    <th className="border-r border-[#d8d8d8] px-2 py-2 text-left">Add SGST @0%</th>
                    <th className="px-2 py-2 text-left">Add IGST @18%</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border-r border-t border-[#d8d8d8] px-2 py-2">{fmtAmount(cgst)}</td>
                    <td className="border-r border-t border-[#d8d8d8] px-2 py-2">{fmtAmount(sgst)}</td>
                    <td className="border-t border-[#d8d8d8] px-2 py-2">{fmtAmount(igst)}</td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full border border-[#d8d8d8] text-[14px]">
                <tbody>
                  <tr>
                    <td className="border-r border-b border-[#d8d8d8] bg-[#eaf2fb] px-2 py-2 font-semibold">Gross</td>
                    <td className="border-b border-[#d8d8d8] bg-[#eaf2fb] px-2 py-2">{fmtAmount(totalAmount)}</td>
                  </tr>
                  <tr>
                    <td className="border-r border-[#d8d8d8] bg-[#eaf2fb] px-2 py-2 font-semibold">Net Amount</td>
                    <td className="bg-[#eaf2fb] px-2 py-2">{fmtAmount(totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-5 border-t border-[#d8d8d8] pt-3 text-[14px] text-[#2f3f52]">
              <div className="mb-2 text-[19px] font-semibold">Terms & Conditions :</div>
              <div><strong>IMP :</strong> All Cases & Disputes are subject to New Delhi Jurisdiction.</div>
              <div><strong>IMP :</strong> Refunds & cancellations are subject to Hotel's approval.</div>
              <div><strong>IMP :</strong> Service charges as included above are to be collected from the customers on our behalf.</div>
              <div><strong>CHEQUE :</strong> Must be drawn in favour of Atlas.</div>
              <div><strong>LATE PAYMENT :</strong> Interest @ 24% per annum will be charged on all outstanding bills after due date.</div>
              <div><strong>VERY IMP :</strong> Kindly check all details carefully to avoid un-necessary complications.</div>
              <div><strong>*Please note that redeemed TJ Cash and Taxes-fees are non-refundable.</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
