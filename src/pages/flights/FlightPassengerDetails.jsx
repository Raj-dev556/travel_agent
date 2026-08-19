import { ChevronDown, ChevronLeft, Search, Upload, UtensilsCrossed, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import FlightFlowLayout from './FlightFlowLayout';
import {
  DEFAULT_DRAFT,
  MEAL_OPTIONS,
  buildFlowQuery,
  computeFare,
  hydrateFromQuery,
  mergeDraft,
  writeFlowDraft,
} from './flightFlowData';

function TextField({ value, onChange, placeholder = '', type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded border border-[#dedede] bg-white px-3 text-[14px] outline-none focus:border-[#ff7f2a]"
    />
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded border border-[#ddd] bg-white">
      <div className="flex items-center justify-between border-b border-[#e3e3e3] bg-[#f2f2f2] px-4 py-3 text-[16px] font-semibold text-[#354456]">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 text-[#7e8a98]" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function BulkUploadModal({ open, onClose, fileName, onFileSelect, fileError }) {
  const fileInputRef = useRef(null);

  if (!open) return null;

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[1150px] rounded border border-[#c8c8c8] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#d9d9d9] px-4 py-3">
          <div className="text-[24px] font-semibold text-[#3e4c5f]">Upload Passenger Details</div>
          <button type="button" onClick={onClose} className="text-[#111]">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4">
          <div
            className="grid min-h-[120px] place-items-center rounded border-2 border-dashed border-[#ff8e4a] bg-[#fbfbfb] text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
          >
            <div>
              <div className="inline-flex items-center gap-2 text-[18px] font-semibold text-[#3f4f62]">
                <Upload className="h-5 w-5 text-[#6a7787]" />
                Drag &amp; Drop your file or{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="underline"
                >
                  Browse
                </button>
              </div>
              <div className="mt-2 text-[14px] font-semibold text-[#7f8a96]">Max File Size: 5 MB</div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileSelect(file);
            }}
          />

          <div className="mt-4">
            <a href="#" className="text-[16px] font-semibold text-[#0a57b5] underline">
              Download Sample Template
            </a>
          </div>

          {fileName ? <div className="mt-3 text-[14px] text-[#4d5b6c]">Selected file: {fileName}</div> : null}
          {fileError ? <div className="mt-2 text-[14px] text-rose-600">{fileError}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function FlightPassengerDetails() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => hydrateFromQuery(params));
  const [selectedLeg, setSelectedLeg] = useState(0);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkFileError, setBulkFileError] = useState('');

  useEffect(() => {
    writeFlowDraft(draft);
  }, [draft]);

  const fare = useMemo(() => computeFare(draft.amount), [draft.amount]);
  const traveller = draft.travellers?.[0] || DEFAULT_DRAFT.travellers[0];
  const query = buildFlowQuery(draft);

  const formValid = Boolean(
    traveller.fN?.trim() &&
      traveller.lN?.trim() &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(traveller.dob || '')) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(draft.contact.email || '').trim()) &&
      /^\d{7,15}$/.test(String(draft.contact.phone || '').trim()),
  );

  const updateTraveller = (patch) => {
    setDraft((prev) =>
      mergeDraft(prev, {
        travellers: [{ ...prev.travellers[0], ...patch }],
      }),
    );
  };

  const setMeal = (mealId) => {
    setDraft((prev) =>
      mergeDraft(prev, {
        mealByTraveller: { ...prev.mealByTraveller, 0: mealId },
      }),
    );
  };

  const handleBulkFileSelect = (file) => {
    if (!file) return;
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setBulkFileError('File size exceeds 5 MB. Please upload a smaller file.');
      setBulkFileName('');
      return;
    }
    setBulkFileError('');
    setBulkFileName(file.name);
  };

  return (
    <FlightFlowLayout
      step={2}
      title="Passenger Details"
      fare={fare}
      titleAction={(
        <button
          type="button"
          onClick={() => setBulkModalOpen(true)}
          className="rounded border border-[#ff8e4a] bg-white px-4 py-2 text-[14px] font-semibold text-[#ff7f2a] hover:bg-[#fff5ee]"
        >
          Upload Bulk Passenger Details
        </button>
      )}
    >
      <div className="space-y-4">
        <Section title="ADULT 1: (12 + yrs)">
          <div className="mb-4">
            <div className="flex w-[320px] items-center gap-2 rounded border border-[#dfdfdf] bg-[#f7f7f7] px-3 py-2 text-[14px] text-[#6f7d8c]">
              <Search className="h-4 w-4" />
              <span>Search from Travellers List</span>
            </div>
          </div>

          <div className="grid grid-cols-[150px_1fr_1fr_1fr] gap-3">
            <div>
              <div className="mb-1 text-[13px] text-[#7b8797]">Title</div>
              <select
                value={traveller.ti}
                onChange={(e) => updateTraveller({ ti: e.target.value })}
                className="h-10 w-full rounded border border-[#dedede] bg-white px-3 text-[14px] outline-none focus:border-[#ff7f2a]"
              >
                <option>Mr</option>
                <option>Mrs</option>
                <option>Ms</option>
                <option>Mstr</option>
                <option>Miss</option>
              </select>
            </div>
            <div>
              <div className="mb-1 text-[13px] text-[#7b8797]">First Name</div>
              <TextField value={traveller.fN} onChange={(v) => updateTraveller({ fN: v.toUpperCase() })} />
            </div>
            <div>
              <div className="mb-1 text-[13px] text-[#7b8797]">Last Name</div>
              <TextField value={traveller.lN} onChange={(v) => updateTraveller({ lN: v.toUpperCase() })} />
            </div>
            <div>
              <div className="mb-1 text-[13px] text-[#7b8797]">Date of Birth</div>
              <TextField type="date" value={traveller.dob || ''} onChange={(v) => updateTraveller({ dob: v })} />
            </div>
          </div>

          <div className="mt-4 border-t border-[#ececec] pt-3">
            <div className="text-[16px] font-semibold text-[#46576a]">FREQUENT FLIER NUMBER (OPTIONAL)</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 text-[13px] text-[#7b8797]">Airline</div>
                <TextField value="AI" onChange={() => {}} />
              </div>
              <div>
                <div className="mb-1 text-[13px] text-[#7b8797]">FF Number</div>
                <TextField value="" onChange={() => {}} />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-[14px] font-semibold text-[#3d4d5f]">
              <input type="checkbox" checked readOnly className="accent-[#ff7f2a]" />
              Add this to My Travellers List <span className="font-normal text-[#7d8a98]">(This will avoid session timeout and enable faster bookings)</span>
            </label>
          </div>
        </Section>

        <Section title="Flight Add On">
          <div className="rounded border border-[#e2e2e2] bg-[#fafafa] p-3">
            <div className="mb-2 flex items-center gap-2 text-[17px] font-semibold text-[#364658]">
              <UtensilsCrossed className="h-5 w-5 text-[#596b7e]" /> SELECT MEAL
            </div>

            <div className="mb-4 flex gap-2">
              {['PNQ -> DEL', 'DEL -> JAI', 'JAI -> BLR'].map((leg, idx) => (
                <button
                  key={leg}
                  type="button"
                  onClick={() => setSelectedLeg(idx)}
                  className={`rounded border px-3 py-2 text-[13px] font-semibold ${
                    selectedLeg === idx ? 'border-[#ff9d5e] bg-[#fff3ea] text-[#d8732f]' : 'border-[#ddd] bg-white text-[#5f6e80]'
                  }`}
                >
                  <div>{leg}</div>
                  <div className="text-[12px]">0/1</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-3">
              {MEAL_OPTIONS.map((meal) => {
                const active = draft.mealByTraveller?.[0] === meal.id;
                return (
                  <button
                    key={meal.id}
                    type="button"
                    onClick={() => setMeal(meal.id)}
                    className={`rounded border p-3 text-center ${active ? 'border-[#ff9d5e] bg-[#fff4ec]' : 'border-[#ddd] bg-white'}`}
                  >
                    <div className="mx-auto grid h-20 place-items-center bg-[#b8d6e7] text-lg font-bold">MEAL</div>
                    <div className="mt-3 text-[14px] font-semibold text-[#415165]">{meal.name}</div>
                    <div className="mt-1 text-[16px] font-bold text-[#374557]">{active ? 'SELECTED' : 'FREE'}</div>
                    <div className="mt-2 rounded border border-[#d5d5d5] bg-[#fafafa] py-1 text-[14px] font-semibold text-[#4c5e73]">Select</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 inline-block rounded border border-[#f0c9a7] bg-[#fff1e3] px-3 py-2 text-[13px] font-semibold text-[#ba6d30]">
              ADULT-1
              <br />
              SELECT MEAL
            </div>
            <div className="mt-2 text-[15px] font-semibold text-[#3e4f63]">
              Total Meal Fee : INR 0.00
            </div>
          </div>
        </Section>

        <Section title="Contact Details">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="mb-1 text-[13px] text-[#7b8797]">Country Code</div>
              <select
                value={draft.contact.countryCode}
                onChange={(e) => setDraft((prev) => mergeDraft(prev, { contact: { countryCode: e.target.value } }))}
                className="h-10 w-full rounded border border-[#dedede] bg-white px-3 text-[14px] outline-none focus:border-[#ff7f2a]"
              >
                <option value="+91">India (+91)</option>
              </select>
            </div>
            <div>
              <div className="mb-1 text-[13px] text-[#7b8797]">Mobile Number *</div>
              <TextField value={draft.contact.phone} onChange={(v) => setDraft((prev) => mergeDraft(prev, { contact: { phone: v } }))} />
            </div>
            <div>
              <div className="mb-1 text-[13px] text-[#7b8797]">Email ID *</div>
              <TextField value={draft.contact.email} onChange={(v) => setDraft((prev) => mergeDraft(prev, { contact: { email: v } }))} />
            </div>
          </div>
        </Section>

        <Section title="Agent Note (Optional)">
          <div className="mb-1 text-[13px] text-[#7b8797]">Add Notes</div>
          <textarea
            value={draft.contact.note}
            onChange={(e) => setDraft((prev) => mergeDraft(prev, { contact: { note: e.target.value } }))}
            className="h-24 w-full rounded border border-[#dedede] bg-white p-3 text-[14px] outline-none focus:border-[#ff7f2a]"
          />
          <div className="mt-2 text-[13px] text-[#9ba6b2]">*These notes are for agent reference only no action will be taken against this.</div>
        </Section>

        <Section title="GST Number for Business Travel (Optional)">
          <div className="mb-3 flex items-center justify-between rounded border border-[#e3e3e3] bg-[#f9f9f9] px-3 py-2 text-[14px] text-[#6d7b8c]">
            <span>Select from History</span>
            <button type="button" className="font-semibold text-[#ff7f2a]">Clear</button>
          </div>

          <div className="mb-3 text-[14px] font-semibold text-[#4b5a6b]">To claim credit of GST charged by airlines, Please enter your company's GST number</div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <div className="mb-1 text-[13px] text-[#7b8797]">Registration Number</div>
              <TextField
                value={draft.gst.gstNumber}
                onChange={(v) => setDraft((prev) => mergeDraft(prev, { gst: { ...prev.gst, gstNumber: v, enabled: Boolean(v) } }))}
              />
            </div>
            <div>
              <div className="mb-1 text-[13px] text-[#7b8797]">Registered Company Name</div>
              <TextField value={draft.gst.registeredName} onChange={(v) => setDraft((prev) => mergeDraft(prev, { gst: { registeredName: v } }))} />
            </div>
            <div>
              <div className="mb-1 text-[13px] text-[#7b8797]">Registered Email</div>
              <TextField value={draft.gst.email} onChange={(v) => setDraft((prev) => mergeDraft(prev, { gst: { email: v } }))} />
            </div>
            <div>
              <div className="mb-1 text-[13px] text-[#7b8797]">Registered Phone</div>
              <TextField value={draft.gst.phone} onChange={(v) => setDraft((prev) => mergeDraft(prev, { gst: { phone: v } }))} />
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 text-[13px] text-[#7b8797]">Registered Address</div>
            <TextField value={draft.gst.address} onChange={(v) => setDraft((prev) => mergeDraft(prev, { gst: { address: v } }))} />
          </div>
          <label className="mt-4 flex items-center gap-2 text-[14px] font-semibold text-[#3d4d5f]">
            <input type="checkbox" checked={draft.gst.enabled} onChange={(e) => setDraft((prev) => mergeDraft(prev, { gst: { enabled: e.target.checked } }))} className="accent-[#ff7f2a]" />
            Save GST Details
          </label>
        </Section>

        <div className="flex items-center justify-between pb-2">
          <button type="button" onClick={() => navigate(`/flights/itinerary?${query}`)} className="inline-flex items-center rounded bg-[#ff7f2a] px-7 py-3 text-[15px] font-bold text-white">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <button
            type="button"
            disabled={!formValid}
            onClick={() => navigate(`/flights/review?${query}`)}
            className="rounded bg-[#ff7f2a] px-8 py-3 text-[17px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            PROCEED TO REVIEW {'>>'}
          </button>
        </div>
      </div>

      <BulkUploadModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        fileName={bulkFileName}
        fileError={bulkFileError}
        onFileSelect={handleBulkFileSelect}
      />
    </FlightFlowLayout>
  );
}
