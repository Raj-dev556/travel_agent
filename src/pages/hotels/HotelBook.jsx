import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertCircle, ChevronDown, ChevronUp, ChevronsRight, Hourglass, Star, Utensils, Zap } from 'lucide-react';
import api from '../../api';
import {
  buildFareBreakdown,
  collectPolicySections,
  extractCheckInOutTimes,
  extractPricingFromSource,
  firstResult,
  formatCancellationSummary,
  imageUrl,
  optionToRoom,
  saveHotelBookingSnapshot,
} from './hotelTripjackHelpers';
import { saveHotelRecentBooking } from './hotelUserHistory';

const TITLES = ['Mr', 'Mrs', 'Ms', 'Mstr', 'Miss'];

function newPax(pt = 'ADULT') {
  return { ti: pt === 'ADULT' ? 'Mr' : 'Mstr', fN: '', lN: '', pt, age: pt === 'CHILD' ? 8 : undefined, pNa: 'IN' };
}

export default function HotelBook() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const optionId = params.get('optionId') || '';
  const selectedAmount = params.get('amount') || '';
  const selectedMealBasis = params.get('mealBasis') || '';
  const selectedRoomName = params.get('roomName') || '';
  const nationality = params.get('nationality') || params.get('residence') || '106';
  const checkin = params.get('checkin') || new Date().toISOString().slice(0, 10);
  const checkout = params.get('checkout') || addDays(checkin, 1);
  const rooms = useMemo(() => safeParseRooms(params.get('rooms')), [params]);

  const [paxByRoom, setPaxByRoom] = useState(() =>
    rooms.map((r) => [
      ...Array(r.adults || 0).fill(0).map(() => newPax('ADULT')),
      ...Array(r.children || 0).fill(0).map(() => newPax('CHILD')),
    ]),
  );
  const [contact, setContact] = useState({ code: 'India (+91)', phone: '', email: '' });
  const [special, setSpecial] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [fareExpanded, setFareExpanded] = useState({ base: false, taxes: false, total: false });
  const [panType, setPanType] = useState('personal');
  const [useGuardianPan, setUseGuardianPan] = useState(false);
  const [personalPans, setPersonalPans] = useState([
    { name: '', number: '', verified: false, error: '' },
  ]);
  const [corporatePan, setCorporatePan] = useState({ number: '', verified: false, error: '' });

  const selectedOptionId = optionId;
  const selectedReviewHash = params.get('reviewHash') || '';

  const reviewPayload = useMemo(() => ({
    tjHotelId: String(id || '').trim(),
    optionId: selectedOptionId,
    reviewHash: selectedReviewHash,
  }), [id, selectedOptionId, selectedReviewHash]);

  const { data: reviewResponse, isLoading: isReviewLoading, error: reviewError } = useQuery({
    queryKey: ['hotelReview-booking', reviewPayload],
    queryFn: () => api.post('/hotels/review', reviewPayload).then((r) => r.data),
    enabled: Boolean(reviewPayload.tjHotelId && reviewPayload.optionId && reviewPayload.reviewHash),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  const { data: staticResponse } = useQuery({
    queryKey: ['hotelStatic-booking', String(id || '').trim()],
    queryFn: () => api.post('/hotels/hotel-details/static', { tjHotelId: String(id || '').trim() }).then((r) => r.data),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const review = firstResult(reviewResponse);
  // The static endpoint is backed by the hotels MongoDB collection and is queried
  // with this page's tjHotelId. Some responses return the hotel document directly;
  // others wrap it in `data`, `result`, or `staticContent`.
  const staticRecord = firstResult(staticResponse) || staticResponse?.hotel || staticResponse || {};
  const staticContent = staticRecord?.staticContent || staticResponse?.staticContent || staticRecord || {};
  const propertyPolicies = staticContent.policies || {};
  const addressData = staticContent.address || {};
  const reviewOption = review?.option || {
    optionId: selectedOptionId,
    roomInfo: [{ name: selectedRoomName }],
    mealBasis: selectedMealBasis || 'Room Only',
    pricing: { totalPrice: Number(selectedAmount || 0), currency: 'INR' },
    cancellation: { isRefundable: false, penalties: [] },
    compliance: {},
  };
  const selectedRoom = optionToRoom(reviewOption);
  const city = addressData.cityName || params.get('city') || '';
  const hotelName = review?.hotelName || staticRecord?.hotelName || params.get('hotelName') || 'Hotel';
  const address = addressData.fullAddress || [addressData.line1, addressData.line2, city, addressData.stateName, addressData.countryName].filter(Boolean).join(', ');
  const postalCode = addressData.postalCode || '';
  const starCount = Number(staticRecord?.starRating || staticRecord?.star_rating || 0);

  const nights = nightCount(checkin, checkout);
  const totalRooms = rooms.length;
  const totalGuests = rooms.reduce((sum, r) => sum + Number(r.adults || 0) + Number(r.children || 0), 0);
  const roomAdults = rooms.reduce((sum, r) => sum + Number(r.adults || 0), 0);
  const roomChildren = rooms.reduce((sum, r) => sum + Number(r.children || 0), 0);

  const fare = buildFareBreakdown(selectedRoom?.pricing, selectedRoom?.totalRateINR || selectedAmount);
  const {
    totalPayable,
    baseFare,
    taxesAndFees,
    markup,
    managementFees,
    managementFeesTax,
    grossPrice,
    totalMarkup,
    netPrice,
  } = fare;
  const cancellationSummary = formatCancellationSummary(selectedRoom?.cancellation);
  const cancellationPenalties = Array.isArray(selectedRoom?.cancellation?.penalties)
    ? selectedRoom.cancellation.penalties
    : [];
  const availableBalance = 4935446.31;
  const checkInOutTimes = extractCheckInOutTimes(propertyPolicies);
  const importantPolicies = collectPolicySections(propertyPolicies)
    .filter((section) => !['Check-in', 'Check-out'].includes(section.title));
  const personalPansVerified = personalPans.length > 0 && personalPans.every((pan) => pan.verified);
  const activePanVerified = panType === 'personal' ? personalPansVerified : corporatePan.verified;

  const gallery = [
    ...(staticContent.images || []).map(imageUrl).filter(Boolean),
    ...(selectedRoom?.images || []),
  ];
  const heroImage = gallery[0] || '';

  const formValid =
    selectedRoom &&
    selectedOptionId &&
    selectedReviewHash &&
    review?.bookingId &&
    agreed &&
    paxByRoom.every((room) => room.every((p) => p.fN.trim() && p.lN.trim() && p.ti)) &&
    /\S+@\S+/.test(contact.email) &&
    contact.phone.trim().length >= 7;

  const panRequired = Boolean(selectedRoom?.panRequired);
  const bookingFormValid = formValid && (!panRequired || activePanVerified);

  const handleProceed = () => {
    const bookingId = review?.bookingId;
    if (!bookingId) return;

    const leadPax = paxByRoom[0]?.[0];
    const reviewFare = extractPricingFromSource(review?.option) || extractPricingFromSource(review) || fare;

    saveHotelBookingSnapshot(bookingId, {
      bookingId,
      hotelName,
      address,
      city,
      postalCode,
      starCount,
      checkin,
      checkout,
      nights,
      totalRooms,
      totalGuests,
      roomAdults,
      roomChildren,
      selectedRoom: {
        name: selectedRoom?.name || '',
        boardBasis: selectedRoom?.boardBasis || selectedRoom?.mealBasis || '',
        mealBasis: selectedRoom?.mealBasis || '',
        refundable: Boolean(selectedRoom?.refundable),
      },
      fare: reviewFare,
      cancellationPenalties,
      leadGuestName: leadPax ? `${leadPax.ti} ${leadPax.fN} ${leadPax.lN}`.trim() : '',
      contact,
    });

    saveHotelRecentBooking({
      bookingId,
      hotelName,
      city,
      country: addressData.countryName || 'IN',
      checkin,
      checkout,
      amount: reviewFare?.totalPayable || selectedRoom?.totalRateINR || selectedAmount,
      status: 'On Hold',
      review,
    });

    navigate(`/hotels/confirm?bookingId=${encodeURIComponent(bookingId)}`);
  };

  const updatePax = (rIdx, pIdx, patch) =>
    setPaxByRoom((arr) =>
      arr.map((room, i) =>
        i === rIdx ? room.map((p, j) => (j === pIdx ? { ...p, ...patch } : p)) : room,
      ),
    );

  const toggleFare = (key) =>
    setFareExpanded((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));

  const updatePersonalPan = (index, patch) => {
    setPersonalPans((current) => current.map((pan, panIndex) => (
      panIndex === index ? { ...pan, ...patch, verified: false, error: '' } : pan
    )));
  };

  const updateCorporatePan = (patch) => {
    setCorporatePan((current) => ({ ...current, ...patch, verified: false, error: '' }));
  };

  const addPersonalPan = () => {
    setPersonalPans((current) => {
      if (current.length >= totalGuests) return current;
      return [...current, { name: '', number: '', verified: false, error: '' }];
    });
  };

  const removePersonalPan = (index) => {
    setPersonalPans((current) => (
      current.length > 1 ? current.filter((_, panIndex) => panIndex !== index) : current
    ));
  };

  const verifyPersonalPan = (index) => {
    const current = personalPans[index];
    if (!current) return;
    const formattedNumber = current.number.trim().toUpperCase();
    const error = !/^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$/.test(formattedNumber)
      ? 'Enter a valid Personal PAN.'
      : !current.name.trim()
        ? 'Enter the PAN holder name.'
        : '';
    setPersonalPans((rows) => rows.map((pan, panIndex) => (
      panIndex === index
        ? { ...pan, number: formattedNumber, verified: !error, error }
        : pan
    )));
  };

  const verifyCorporatePan = () => {
    const formattedNumber = corporatePan.number.trim().toUpperCase();
    const error = /^[A-Z]{3}C[A-Z][0-9]{4}[A-Z]$/.test(formattedNumber)
      ? ''
      : 'Enter a valid Corporate PAN.';
    setCorporatePan((current) => ({ ...current, number: formattedNumber, verified: !error, error }));
  };

  if (isReviewLoading) return <div className="p-8 text-center text-slate-500">Loading booking review...</div>;

  return (
    <div className="bg-[#f3f4f6] min-h-[calc(100vh-6.25rem)] lg:h-[calc(100vh-6.25rem)] lg:overflow-hidden">
      <div className="max-w-[1120px] mx-auto px-4 py-6 h-full">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:h-[calc(100vh-9.5rem)]">
          <div className="space-y-3 lg:overflow-y-auto lg:pr-2 lg:pb-10 tj-scrollbar-hidden">
            <h1 className="text-[27px] font-semibold leading-tight text-slate-800">Review Your Booking</h1>
            <section>
              <div className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-start">
                <div className="h-[140px] overflow-hidden rounded-lg bg-slate-200">
                  {heroImage ? (
                    <img src={heroImage} alt={hotelName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">No image</div>
                  )}
                </div>
                <div>
                  <div className="text-[24px] font-semibold leading-tight text-slate-800">{hotelName}</div>
                  <div className="mt-1 inline-flex items-center gap-0.5">
                    {Array.from({ length: Math.max(0, starCount) }).map((_, idx) => (
                      <Star key={idx} className="h-4 w-4 fill-[#f6b70f] text-[#f6b70f]" />
                    ))}
                  </div>
                  <div className="mt-2 text-[16px] text-slate-600">{address}</div>
                  {postalCode && <div className="text-[15px] text-slate-600">Postal Code: {postalCode}</div>}
                </div>
                <div className="text-right">
                  <Link to={`/hotels/${id}?${params.toString()}`} className="text-[12px] text-[#f2711c] hover:underline">
                    &laquo; Back to hotel details
                  </Link>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[#e5d7ca] bg-white p-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <SummaryCell label="Check In" value={prettyDate(checkin)} />
                <SummaryCell label="" value={`${nights} Night${nights > 1 ? 's' : ''}`} centered badge />
                <SummaryCell label="Check Out" value={prettyDate(checkout)} />
                <SummaryCell label="Total Rooms" value={`${totalRooms} Room${totalRooms > 1 ? 's' : ''}`} />
                <SummaryCell label="Total Guests" value={`${totalGuests} Guest${totalGuests > 1 ? 's' : ''}`} />
              </div>
            </section>

            <section className="rounded-xl border border-[#e5d7ca] bg-white px-4 py-2">
              <div className="flex flex-wrap items-center justify-between gap-4 text-[13px] text-slate-700">
                <div>
                  Check In <span className="ml-1 rounded-full bg-[#f5e5d8] px-3 py-0.5 font-semibold">{checkInOutTimes.checkIn || '3:00 PM - anytime'}</span>
                </div>
                <div className="h-4 w-px bg-slate-300" />
                <div>
                  Check Out <span className="ml-1 rounded-full bg-[#f5e5d8] px-3 py-0.5 font-semibold">{checkInOutTimes.checkOut || '12:00 PM'}</span>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[#e5d7ca] bg-white p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-[18px] font-semibold leading-tight text-slate-800">{selectedRoom?.name || 'Club Room, 1 King Bed, Golf View'}</div>
                  <div className="text-[12px] text-slate-500 mt-1">({roomAdults} Adult{roomAdults > 1 ? 's' : ''}{roomChildren ? `, ${roomChildren} Children` : ''})</div>
                </div>
                <div>
                  <div className="text-[18px] font-semibold leading-tight text-slate-800">
                    {selectedRoom?.refundable ? 'Refundable' : 'Non Refundable'} | {selectedRoom?.boardBasis || 'Room Only'}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-3">
              <label className="inline-flex items-center gap-2.5 text-[13px] text-slate-700 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                I confirm that I have reviewed and agree to proceed with the selected room(s) for booking.
              </label>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-[24px] font-semibold text-slate-800">Cancellation Policy</h2>
              <div className="mt-3 overflow-hidden rounded-lg border border-slate-300">
                <table className="w-full text-[13px]">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="border-r border-slate-300 px-3 py-2 text-left font-semibold">Cancellation on or After</th>
                      <th className="border-r border-slate-300 px-3 py-2 text-left font-semibold">Cancellation on or Before</th>
                      <th className="px-3 py-2 text-left font-semibold">Cancellation Charges/Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cancellationPenalties.length ? cancellationPenalties : [{ from: checkin, to: checkout, amount: totalPayable }]).map((row, index) => (
                      <tr key={index} className="bg-white text-slate-700">
                        <td className="border-r border-t border-slate-300 px-3 py-2">{formatPolicyDate(String(row.from || '').slice(0, 10))}</td>
                        <td className="border-r border-t border-slate-300 px-3 py-2">{formatPolicyDate(String(row.to || '').slice(0, 10))}</td>
                        <td className="border-t border-slate-300 px-3 py-2">{fmtINR(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="mt-3 space-y-1 text-[13px] text-slate-600">
                <li>- {cancellationSummary}</li>
                <li>- In case of a no-show, full cancellation charges may apply.</li>
                <li>- Early checkout may attract a charge as per hotel policy.</li>
              </ul>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-[24px] font-semibold text-slate-800">Guest Details</h2>
              <div className="text-[12px] text-slate-500">Only lead guest name is required.</div>

              {paxByRoom.map((room, rIdx) => (
                <div key={rIdx} className="mt-3 rounded-lg border border-[#dbe3ed] overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#e9f0fa] px-3 py-2 text-[13px]">
                    <div>
                      <strong>Room {rIdx + 1}:</strong> {selectedRoom?.name || `Room ${rIdx + 1}`}
                    </div>
                    <div className="inline-flex items-center gap-1 text-slate-600">
                      <Utensils className="h-3.5 w-3.5" /> {selectedRoom?.boardBasis || 'Room Only'}
                    </div>
                  </div>
                  <div className="bg-[#f7eee7] px-3 py-2 text-[13px] text-slate-700">
                    {rooms[rIdx]?.adults || 0} Adults | {rooms[rIdx]?.children || 0} Children
                  </div>

                  <div className="p-3 space-y-2">
                    {room.map((p, pIdx) => (
                      <div key={pIdx} className="grid gap-2 md:grid-cols-[90px_1fr_1fr_90px]">
                        <select
                          className="rounded border border-slate-300 px-2 py-2 text-[13px]"
                          value={p.ti}
                          onChange={(e) => updatePax(rIdx, pIdx, { ti: e.target.value })}
                        >
                          {TITLES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <input
                          className="rounded border border-slate-300 px-3 py-2 text-[13px]"
                          placeholder="Lead Pax First Name"
                          value={p.fN}
                          onChange={(e) => updatePax(rIdx, pIdx, { fN: e.target.value })}
                        />
                        <input
                          className="rounded border border-slate-300 px-3 py-2 text-[13px]"
                          placeholder="Last Name"
                          value={p.lN}
                          onChange={(e) => updatePax(rIdx, pIdx, { lN: e.target.value })}
                        />
                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs text-slate-600">
                          {p.pt}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <h2 className="text-[24px] font-semibold text-slate-800">Contact Details</h2>
              <div className="mt-2 grid gap-2 md:grid-cols-[150px_1fr_1fr]">
                <select
                  className="rounded border border-slate-300 px-2 py-2 text-[13px]"
                  value={contact.code}
                  onChange={(e) => setContact((prev) => ({ ...prev, code: e.target.value }))}
                >
                  <option value="India (+91)">India (+91)</option>
                  <option value="UAE (+971)">UAE (+971)</option>
                  <option value="Singapore (+65)">Singapore (+65)</option>
                </select>
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-[13px]"
                  placeholder="Mobile No."
                  value={contact.phone}
                  onChange={(e) => setContact((prev) => ({ ...prev, phone: e.target.value }))}
                />
                <input
                  className="rounded border border-slate-300 px-3 py-2 text-[13px]"
                  placeholder="Email ID"
                  value={contact.email}
                  onChange={(e) => setContact((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-[24px] font-semibold text-slate-800">PAN Information</h2>
              <div className="mt-3 flex items-center gap-8 rounded-lg bg-[#e9f2ff] px-4 py-3">
                <PanChoice label="Personal PAN" checked={panType === 'personal'} onChange={() => setPanType('personal')} />
                <PanChoice label="Corporate PAN" checked={panType === 'corporate'} onChange={() => setPanType('corporate')} />
              </div>

              {panType === 'personal' ? (
                <div className="mt-4">
                  <label className="inline-flex items-center gap-2 text-[13px] text-[#f2711c] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useGuardianPan}
                      onChange={(event) => setUseGuardianPan(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Use Only Guardian PAN
                  </label>
                  <div className="mt-3 space-y-3">
                    {personalPans.map((pan, index) => (
                      <div key={`personal-pan-${index}`} className="rounded-lg border border-slate-200 p-3">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                          <PanInput
                            label={useGuardianPan && index === 0 ? 'Guardian Name' : `Name (Guest ${index + 1})`}
                            value={pan.name}
                            placeholder="Name as per PAN"
                            onChange={(value) => updatePersonalPan(index, { name: value })}
                          />
                          <PanInput
                            label="PAN"
                            value={pan.number}
                            placeholder="ABCDE1234F"
                            maxLength={10}
                            onChange={(value) => updatePersonalPan(index, { number: value.toUpperCase() })}
                          />
                          <div className="flex items-center gap-2">
                            <PanVerifyButton verified={pan.verified} onClick={() => verifyPersonalPan(index)} />
                            {personalPans.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removePersonalPan(index)}
                                className="rounded-md border border-slate-300 px-3 py-2.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                        {pan.error && <p className="mt-2 text-xs font-medium text-red-600">{pan.error}</p>}
                      </div>
                    ))}
                  </div>
                  {personalPans.length < totalGuests && (
                    <button
                      type="button"
                      onClick={addPersonalPan}
                      className="mt-3 rounded-md bg-[#ff7a00] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#e56a00]"
                    >
                      + Add PAN
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border-2 border-slate-200 p-5">
                  <div className="grid gap-3 md:grid-cols-[390px_auto] md:items-end">
                    <PanInput
                      label="Corporate PAN Number"
                      value={corporatePan.number}
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      onChange={(value) => updateCorporatePan({ number: value.toUpperCase() })}
                    />
                    <PanVerifyButton verified={corporatePan.verified} onClick={verifyCorporatePan} />
                  </div>
                  {corporatePan.error && <p className="mt-2 text-xs font-medium text-red-600">{corporatePan.error}</p>}
                  <p className="mt-5 max-w-4xl text-[13px] leading-6 text-slate-600">
                    By proceeding, you confirm that the PAN/GST details belong to the same legal entity for which this booking is made and that the stay is for official business purposes. GST benefits are subject to eligibility under applicable law and the company is responsible for the accuracy of these details.
                  </p>
                  <button type="button" className="mt-1 text-[13px] font-semibold text-[#2f80ed] hover:underline">View Terms &amp; Conditions</button>
                </div>
              )}
            </section>


            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-[24px] font-semibold text-slate-800">Important Information</h2>
              {importantPolicies.length > 0 ? (
                <div className="mt-3 space-y-5">
                  {importantPolicies.map((policy) => (
                    <div key={policy.title}>
                      <h3 className="text-[15px] font-semibold text-slate-800">{policy.title}</h3>
                      <p className="mt-1 whitespace-pre-line text-[13px] leading-6 text-slate-600">{policy.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[13px] leading-6 text-slate-600">
                  Booking notes and general terms apply. Hotel policies may require photo identification during check-in. Early check-in and late checkout are subject to availability and may be chargeable.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-[24px] font-semibold text-slate-800">Special Request <span className="text-[13px] font-normal text-slate-500">(If Any)</span></h2>
              <textarea
                className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-[13px] min-h-[90px]"
                placeholder="Enter your special requests here"
                value={special}
                onChange={(e) => setSpecial(e.target.value)}
              />
            </section>
          </div>

          <aside className="space-y-3 self-start lg:mt-[4.2rem]">
            <section className="overflow-hidden bg-white">
              <div className="bg-[#e7f1fd] px-4 py-3 text-[16px] font-medium text-slate-800">FARE SUMMARY</div>
              <div className="px-4 py-1 text-[16px]">
                <div className="border-b border-dashed border-slate-200 pb-2">
                  <button type="button" onClick={() => toggleFare('base')} className="flex w-full items-center justify-between py-2.5">
                    <span className="inline-flex items-center gap-1 text-slate-700">
                      Base Fare
                      {fareExpanded.base ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                    </span>
                    <span className="font-medium text-slate-800">{fmtINR(baseFare)}</span>
                  </button>
                  {fareExpanded.base && (
                    <div className="flex items-center justify-between pb-2 text-[12px] text-slate-500">
                      <div className="truncate pr-3">{selectedRoom?.name || 'Club Room, 1 King Bed'}</div>
                      <div>{fmtINR(baseFare)}</div>
                    </div>
                  )}
                </div>

                <div className="border-b border-dashed border-slate-200">
                  <button type="button" onClick={() => toggleFare('taxes')} className="flex w-full items-center justify-between py-2.5">
                    <span className="inline-flex items-center gap-1 text-slate-700">
                      Taxes and fees
                      {fareExpanded.taxes ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                    </span>
                    <span className="font-medium text-slate-800">{fmtINR(taxesAndFees)}</span>
                  </button>
                  {fareExpanded.taxes && (
                    <div className="space-y-1 pb-2 text-[12px] text-slate-500">
                      <div className="flex items-center justify-between">
                        <div>Markup</div>
                        <div>{fmtINR(markup)}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>Management Fees</div>
                        <div>{fmtINR(managementFees)}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>Management Fees Tax</div>
                        <div>{fmtINR(managementFeesTax)}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <button type="button" onClick={() => toggleFare('total')} className="flex w-full items-center justify-between py-2.5">
                    <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                      Total Amount Payable
                      {fareExpanded.total ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                    </span>
                    <span className="font-bold text-slate-900">{fmtINR(totalPayable)}</span>
                  </button>
                  {fareExpanded.total && (
                    <div className="space-y-1 pb-2 text-[12px] text-slate-500">
                      <div className="flex items-center justify-between">
                        <div>Gross Price</div>
                        <div>{fmtINR(grossPrice)}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>Markup</div>
                        <div>{fmtINRNegative(totalMarkup)}</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>Net Price</div>
                        <div>{fmtINR(netPrice)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border-2 border-slate-200 bg-white p-4">
              <div className="grid grid-cols-[auto_1fr] items-center gap-4">
                <div className="whitespace-nowrap">
                  <div className="text-[20px] font-medium text-slate-800">TJ Cash</div>
                  <div className="text-[16px] text-slate-700">1 Cash = ₹1</div>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  className="min-w-0 rounded-lg border-2 border-slate-200 px-3 py-2 text-[14px] outline-none focus:border-[#ff7a00]"
                  placeholder="Enter Cash Amount"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                />
                <button type="button" className="rounded-lg bg-[#f5821f] px-3 py-2 text-[14px] font-semibold text-white hover:bg-[#e56a00]">Redeem</button>
                </div>
              </div>
            </section>

            <div className="px-1 text-[13px] leading-5 text-slate-600">
              By proceeding, I confirm that I agree to all <a href="https://static.tripjack.com/hotel/Standard_declaration_TCS.pdf" target="_blank" rel="noreferrer" className="font-semibold text-[#0b65c2] hover:underline">terms &amp; conditions</a> and I will follow all Government Compliance for TCS.
            </div>

            <div className="px-1 text-[13px] text-slate-600">✓ From Wallet/Credit line</div>
            <button type="button" className="w-full rounded-md bg-[#f5821f] py-2.5 text-[16px] font-semibold text-white hover:bg-[#e56a00]">
              <span className="inline-flex items-center gap-2"><Zap className="h-4 w-4 fill-current" /> QUICK PAY</span>
              <div className="text-[12px] font-medium">Available Balance : {fmtINR(availableBalance)}</div>
            </button>

            <div className="px-1 text-[13px] text-slate-600">✓ From Card/UPI or other modes</div>
            <button
              disabled={!bookingFormValid}
              onClick={handleProceed}
              className={clsx(
                'w-full rounded-md py-3 text-[16px] font-semibold text-white',
                bookingFormValid ? 'bg-[#f5821f] hover:bg-[#e56a00]' : 'bg-[#f5821f]/60 cursor-not-allowed',
              )}
            >
              <span className="inline-flex items-center gap-2"><ChevronsRight className="h-5 w-5" />Proceed To Pay</span>
            </button>

            <div className="px-1 text-[13px] text-slate-600">✓ To Hold Booking</div>
            <button type="button" className="w-full rounded-md border-2 border-[#f5821f] py-3 text-[16px] font-semibold text-[#f5821f] hover:bg-orange-50">
              <span className="inline-flex items-center gap-2"><Hourglass className="h-4 w-4" />Hold/Block</span>
            </button>

            {reviewError && (
              <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 inline-flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                {reviewError?.response?.data?.message || 'Hotel review failed. Please try again.'}
              </div>
            )}

            {(!selectedOptionId || !selectedReviewHash) && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Missing room review data. Please go back to hotel details and continue booking again.
              </div>
            )}

            <Link to={`/hotels/${id}?${params.toString()}`} className="block text-center text-xs text-slate-500 hover:underline">
              Back to hotel details
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}

function PanChoice({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-[16px] font-semibold text-slate-800 cursor-pointer">
      <input
        type="radio"
        name="panType"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 border-slate-300 accent-[#ff7a00]"
      />
      {label}
    </label>
  );
}

function PanInput({ label, value, placeholder, maxLength, onChange }) {
  return (
    <label className="block text-[13px] font-medium text-slate-700">
      <span>{label}</span>
      <input
        className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2.5 text-[14px] uppercase outline-none focus:border-[#ff7a00] focus:ring-1 focus:ring-[#ff7a00]"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function PanVerifyButton({ verified, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-md px-8 py-2.5 text-[14px] font-semibold text-white',
        verified ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#ff7a00] hover:bg-[#e56a00]',
      )}
    >
      {verified ? 'Verified' : 'Verify'}
    </button>
  );
}

function SummaryCell({ label, value, centered = false, badge = false }) {
  return (
    <div className={clsx('rounded border border-[#f0e1d4] px-3 py-2', centered && 'text-center')}>
      {label ? <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div> : <div className="text-[11px] uppercase tracking-wide text-transparent">.</div>}
      {badge ? (
        <span className="inline-flex rounded-full bg-[#f5e5d8] px-3 py-0.5 text-[13px] font-semibold text-slate-700">{value}</span>
      ) : (
        <div className="text-[13px] font-semibold text-slate-800">{value}</div>
      )}
    </div>
  );
}

function safeParseRooms(raw) {
  try {
    const parsed = JSON.parse(raw || '');
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    // fallback
  }
  return [{ adults: 1, children: 0, ages: [] }];
}

function nightCount(checkin, checkout) {
  if (!checkin || !checkout) return 1;
  const diff = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
  return Math.max(1, diff);
}

function prettyDate(v) {
  if (!v) return '--';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatPolicyDate(v) {
  if (!v) return '--';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '--';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${mm}-${yyyy}`;
}

function toDetailRooms(rooms) {
  return rooms.map((room) => {
    const children = Number(room.children || 0);
    const next = { adults: Number(room.adults || 1), children };
    if (children > 0) next.childAge = Array.isArray(room.ages) ? room.ages.map(Number).filter((age) => age > 0) : [];
    return next;
  });
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function fmtINR(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);
}

function fmtINRNegative(n) {
  return `-${fmtINR(Math.abs(Number(n) || 0))}`;
}
