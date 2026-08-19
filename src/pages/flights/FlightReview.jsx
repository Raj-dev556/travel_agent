import { Briefcase, ChevronLeft, Hourglass, Plane } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../../api';
import FlightFlowLayout from './FlightFlowLayout';
import {
  ITINERARY_LAYOVERS,
  ITINERARY_SEGMENTS,
  buildBookPayload,
  buildFlowQuery,
  computeFare,
  getMealName,
  hydrateFromQuery,
  mergeDraft,
  validateBookDraft,
  writeFlowDraft,
} from './flightFlowData';

function SegmentCard({ segment }) {
  return (
    <div className="border-b border-[#e3e3e3] px-4 py-4">
      <div className="grid grid-cols-[220px_1fr_120px_1fr_140px] gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center bg-[#de3030] text-white">
              <Plane className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[16px] font-bold leading-none text-[#29384a]">{segment.airline}</div>
              <div className="mt-1 text-[13px] font-semibold text-[#6f7d8b]">
                {segment.flightNo} <span className="text-[#8a97a4]">{segment.code}</span>
              </div>
            </div>
          </div>
          <div className="mt-9 inline-block bg-[#f2dd85] px-1.5 py-0.5 text-[12px] font-semibold text-[#6e5f26]">Published</div>
          <div className="mt-4 flex items-center gap-2 text-[14px] text-[#647488]">
            <Briefcase className="h-4 w-4" /> : (Adult) Check-in : 15KG, Cabin : 7 Kg
          </div>
        </div>

        <div>
          <div className="text-[17px] font-bold text-[#2e3b4a]">{segment.depDateTime}</div>
          <div className="text-[15px] text-[#6d7b8b]">{segment.depCity}</div>
          <div className="text-[15px] font-semibold text-[#7f8d9b]">{segment.depAirport}</div>
        </div>

        <div className="pt-4 text-center">
          <div className="text-[13px] text-[#5f6e80]">Non-Stop</div>
          <Plane className="mx-auto mt-2 h-5 w-5 rotate-90 text-[#b4bcc3]" />
        </div>

        <div>
          <div className="text-[17px] font-bold text-[#2e3b4a]">{segment.arrDateTime}</div>
          <div className="text-[15px] text-[#6d7b8b]">{segment.arrCity}</div>
          <div className="text-[15px] font-semibold text-[#7f8d9b]">{segment.arrAirport}</div>
        </div>

        <div>
          <div className="text-[21px] font-bold text-[#2e3b4a]">{segment.duration}</div>
          <div className="whitespace-pre-line text-[15px] font-semibold text-[#6f7e8f]">{segment.refundable.replace(',', ',\n')}</div>
        </div>
      </div>
    </div>
  );
}

export default function FlightReview() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => hydrateFromQuery(params));
  const [alert, setAlert] = useState(null);

  const fare = useMemo(() => computeFare(draft.amount), [draft.amount]);
  const query = buildFlowQuery(draft);
  const mealName = getMealName(draft.mealByTraveller?.[0]);
  const traveller = draft.travellers?.[0];
  const draftErrors = validateBookDraft(draft);
  const canBook = draftErrors.length === 0;

  const book = useMutation({
    mutationFn: () => api.post('/flights/book', buildBookPayload(draft)).then((r) => r.data),
    onSuccess: (data) => {
      const bookingId = data?.bookingId || data?.bookingInfos?.[0]?.bookingId || '';
      const next = mergeDraft(draft, { bookingId });
      writeFlowDraft(next);
      setDraft(next);
      navigate(`/flights/payment?${buildFlowQuery(next)}`);
    },
    onError: (err) => {
      if (err?.response?.status === 401) {
        navigate('/login');
        return;
      }
      const backendValidation = err?.response?.data?.details;
      const detailText = Array.isArray(backendValidation) && backendValidation.length ? ` ${backendValidation.join(' ')}` : '';
      setAlert({
        type: 'error',
        text:
          (err?.response?.data?.message || 'There is something went wrong with backend service. It could be due to invalid/bad data.') +
          detailText,
      });
    },
  });

  return (
    <FlightFlowLayout
      step={3}
      title="Review"
      fare={fare}
      includeMealBaggage
      alert={alert}
    >
      <div className="rounded-lg border border-[#ddd] bg-white">
        <div className="flex items-center justify-between border-b border-[#ddd] bg-[#f1f1f1] px-4 py-2 text-[14px] font-bold text-[#4b5967]">
          <div>
            Pune <span className="mx-1">-&gt;</span> Bengaluru <span className="ml-1 text-[#7f8d9c]">on Thu, May 14th 2026</span>
          </div>
          <div className="text-[19px] font-bold text-[#36475b]">17h 50m</div>
        </div>

        {ITINERARY_SEGMENTS.map((segment, idx) => (
          <div key={segment.flightNo}>
            <SegmentCard segment={segment} />
            {idx < ITINERARY_LAYOVERS.length ? (
              <div className="flex justify-center border-b border-[#e3e3e3] py-2">
                <span className="rounded-full border border-[#d6d6d6] bg-[#f2f2f2] px-4 py-1 text-[13px] text-[#4d5967]">
                  Require to change Plane <span className="mx-2"> </span> {ITINERARY_LAYOVERS[idx]}
                </span>
              </div>
            ) : null}
          </div>
        ))}

        <div className="px-4 py-4">
          <div className="text-[20px] font-semibold text-[#233244]">
            Passenger Details (1)
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-t border-[#d8d8d8] text-left">
              <thead className="text-[14px] text-[#7a8796]">
                <tr>
                  <th className="py-2">Sr.</th>
                  <th>Name, Age & Passport</th>
                  <th>Seat Booking</th>
                  <th>Meal & Baggage Preference</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[#e4e4e4] text-[15px]">
                  <td className="py-3 text-[#5d6c7d]">1</td>
                  <td className="font-semibold text-[#2b394a]">
                    {traveller?.ti?.toUpperCase()} {traveller?.fN} {traveller?.lN} (A)
                  </td>
                  <td className="font-semibold text-[#2b394a]">NA</td>
                  <td className="font-semibold text-[#6d7a8a]">MEAL - JAI-BLR : {mealName}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t border-[#e4e4e4] px-4 py-4">
          <div className="text-[17px] font-semibold text-[#223244]">Contact Details</div>
          <div className="mt-3 text-[16px] font-semibold text-[#2a3949]">
            email : {draft.contact.email}
            <br />
            mobile : {draft.contact.phone}
          </div>
        </div>

        <div className="border-t border-[#e4e4e4] px-4 py-4 text-[15px] text-[#8693a1]">
          By proceeding, I acknowledge and agree to the <span className="font-semibold text-[#0a4ca1] underline">terms & conditions.</span>
        </div>

        <div className="flex items-center justify-between border-t border-[#e4e4e4] px-4 py-4">
          <button
            type="button"
            onClick={() => navigate(`/flights/passenger?${query}`)}
            className="inline-flex items-center rounded bg-[#ff7f2a] px-7 py-3 text-[15px] font-bold text-white"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex gap-3">
            <button type="button" className="inline-flex items-center rounded bg-[#ff7f2a] px-7 py-3 text-[17px] font-extrabold text-white">
              <Hourglass className="mr-1 h-4 w-4" /> Block
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canBook) {
                  setAlert({
                    type: 'error',
                    text: draftErrors[0] || 'Please complete Passenger Details and try again.',
                  });
                  return;
                }
                book.mutate();
              }}
              disabled={book.isPending || !canBook}
              className="rounded bg-[#ff7f2a] px-8 py-3 text-[17px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {book.isPending ? 'PROCESSING...' : 'PROCEED TO PAY >>'}
            </button>
          </div>
        </div>
      </div>
    </FlightFlowLayout>
  );
}
