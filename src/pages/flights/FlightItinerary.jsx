import { ArrowRight, Briefcase, ChevronLeft, Plane } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FlightFlowLayout from './FlightFlowLayout';
import { ITINERARY_LAYOVERS, buildFlowQuery, computeFare, getItineraryDisplaySegments, getItineraryDurationText, hydrateFromQuery } from './flightFlowData';

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
          <ArrowRight className="mx-auto mt-2 h-5 w-5 text-[#b4bcc3]" />
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

export default function FlightItinerary() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const draft = useMemo(() => hydrateFromQuery(params), [params]);
  const fare = useMemo(() => computeFare(draft.amount), [draft.amount]);
  const segments = useMemo(() => getItineraryDisplaySegments(draft.itinerary), [draft.itinerary]);
  const firstSegment = segments[0] || {};
  const lastSegment = segments[segments.length - 1] || firstSegment;
  const routeLabel = `${firstSegment.depCity || '--'} -> ${lastSegment.arrCity || '--'}`;
  const dateLabel = String(firstSegment.depDateTime || '--').split(',').slice(0, 2).join(',');

  return (
    <FlightFlowLayout step={1} title="Flight Details" fare={fare}>
      <div className="rounded-lg border border-[#ddd] bg-white">
        <div className="flex items-center justify-between border-b border-[#ddd] bg-[#f1f1f1] px-4 py-2 text-[14px] font-bold text-[#4b5967]">
          <div>
            {routeLabel} <span className="ml-1 text-[#7f8d9c]">on {dateLabel}</span>
          </div>
          <div className="text-[19px] font-bold text-[#36475b]">{getItineraryDurationText(segments)}</div>
        </div>

        {segments.map((segment, idx) => (
          <div key={segment.flightNo}>
            <SegmentCard segment={segment} />
            {idx < segments.length - 1 ? (
              <div className="flex justify-center border-b border-[#e3e3e3] py-2">
                <span className="rounded-full border border-[#d6d6d6] bg-[#f2f2f2] px-4 py-1 text-[13px] text-[#4d5967]">
                  Require to change Plane <span className="mx-2"> </span> {ITINERARY_LAYOVERS[idx] || 'Layover'}
                </span>
              </div>
            ) : null}
          </div>
        ))}

        <div className="flex items-center justify-between px-4 py-4">
          <button type="button" className="rounded border border-[#d5d5d5] bg-[#f5f5f5] px-4 py-2 text-[16px] font-medium text-[#ff7f2a]">
            Fare Rules +
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center rounded bg-[#ff7f2a] px-7 py-3 text-[15px] font-bold text-white">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => navigate(`/flights/passenger?${buildFlowQuery(draft)}`)}
              className="rounded bg-[#ff7f2a] px-8 py-3 text-[16px] font-extrabold text-white"
            >
              ADD PASSENGERS {'>>'}
            </button>
          </div>
        </div>
      </div>
    </FlightFlowLayout>
  );
}
