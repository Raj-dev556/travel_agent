import { Check, ClipboardList, CreditCard, Plane, UserRound } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FLOW_STEPS, fmtINR } from './flightFlowData';

const STEP_ICONS = {
  1: Plane,
  2: UserRound,
  3: ClipboardList,
  4: CreditCard,
};
const FLOW_SESSION_SECONDS = 15 * 60;
const FLOW_SESSION_EXPIRES_KEY = 'flight_flow_session_expires_at_v1';
const FLOW_SESSION_SIGNATURE_KEY = 'flight_flow_session_signature_v1';
const FLOW_COMPLETED_STEP_KEY = 'flight_flow_completed_step_v1';
const FLOW_PROGRESS_SIGNATURE_KEY = 'flight_flow_progress_signature_v1';

function Stepper({ step, completedStep }) {
  const navigate = useNavigate();
  const location = useLocation();
  const stepRoutes = {
    1: '/flights/itinerary',
    2: '/flights/passenger',
    3: '/flights/review',
    4: '/flights/payment',
  };

  const goToStep = (targetStepId) => {
    const route = stepRoutes[targetStepId];
    if (!route) return;
    navigate(`${route}${location.search || ''}`);
  };

  return (
    <div className="border-b border-slate-300 bg-[#f0f0f0]">
      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-4 px-5 py-3 md:grid-cols-4">
        {FLOW_STEPS.map((item, idx) => {
          const done = completedStep > item.id;
          const active = step === item.id;
          const Icon = STEP_ICONS[item.id] || Plane;
          const leftDone = completedStep >= item.id;
          const rightDone = completedStep > item.id;
          const isLast = idx === FLOW_STEPS.length - 1;
          const isFirst = idx === 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => goToStep(item.id)}
              className="group relative flex w-full items-center gap-3 text-left"
              title={`Go to ${item.label}`}
            >
              {!isFirst ? (
                <span className={clsx('absolute left-0 right-1/2 top-5 h-[1.5px]', leftDone ? 'bg-[#58a822]' : 'bg-[#d9d9d9]')} />
              ) : null}
              {!isLast ? (
                <span className={clsx('absolute left-1/2 right-0 top-5 h-[1.5px]', rightDone ? 'bg-[#58a822]' : 'bg-[#d9d9d9]')} />
              ) : null}

              <span
                className={clsx(
                  'relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-white transition-colors',
                  done
                    ? 'border-[#58a822] bg-[#58a822] text-white'
                    : active
                      ? 'border-[#d6d6d6] text-[#9da3aa]'
                      : 'border-[#e2e2e2] text-[#b5b8bd] group-hover:border-[#d4d4d4]',
                )}
              >
                {done ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
              </span>
              <div>
                <div className={clsx('text-[12px] leading-none uppercase tracking-wide', done || active ? 'text-[#7f8c9c]' : 'text-[#a6aebb]')}>
                  {item.title}
                </div>
                <div
                  className={clsx('mt-1 text-[13px] font-semibold leading-none', done ? 'text-[#4f9f12]' : active ? 'text-[#222]' : 'text-[#9d9d9d]')}
                >
                  {item.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FareSummary({ fare, includeMealBaggage = false, showCash = true }) {
  return (
    <aside className="space-y-3">
      <div className="rounded-lg border border-[#ddd] bg-[#f4f4f4]">
        <div className="border-b border-[#e2e2e2] px-4 py-3 text-[13px] font-extrabold uppercase text-[#1c2736]">
          FARE SUMMARY
        </div>
        <div className="space-y-3 px-4 py-3 text-[14px]">
          <div className="flex items-center justify-between font-bold text-[#1e2838]">
            <span>Base fare</span>
            <span>{fmtINR(fare.baseFare)}</span>
          </div>
          <div className="flex items-center justify-between font-bold text-[#1e2838]">
            <span>Taxes and fees</span>
            <span>{fmtINR(fare.taxes)}</span>
          </div>
          {includeMealBaggage ? (
            <div className="flex items-center justify-between font-bold text-[#1e2838]">
              <span>Meal, Baggage & Seat</span>
              <span>{fmtINR(fare.mealBaggage)}</span>
            </div>
          ) : null}
          <div className="border-t border-[#ddd] pt-2">
            <div className="flex items-center justify-between text-[13px] font-bold text-[#1e2838]">
              <span>Amount to Pay</span>
              <span>{fmtINR(fare.total)}</span>
            </div>
            <div className="mt-1 space-y-0.5 text-[12px] text-[#7c8798]">
              <div className="flex justify-between">
                <span>Commission</span>
                <span>{fmtINR(fare.commission)}</span>
              </div>
              <div className="flex justify-between">
                <span>TDS</span>
                <span>{fmtINR(fare.tds)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Net Price</span>
                <span>{fmtINR(fare.netPrice)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCash ? (
        <>
          <div className="rounded-lg border border-[#ddd] bg-[#f4f4f4] px-3 py-3">
            <div className="text-[14px] font-extrabold text-[#1f2a3a]">TJ Cash:</div>
            <div className="mb-2 text-[12px] text-[#5f6b7b]">1 TJ Cash = INR 1</div>
            <div className="flex gap-2">
              <input
                className="h-9 flex-1 rounded border border-[#d4d4d4] bg-white px-3 text-[14px] outline-none"
                placeholder="Enter Cash Amount"
              />
              <button type="button" className="rounded bg-[#ff7f2a] px-4 text-[14px] font-bold text-white">
                REDEEM
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-[#ddd] bg-[#f4f4f4] px-3 py-3">
            <div className="flex gap-2">
              <input
                className="h-9 flex-1 rounded border border-[#d4d4d4] bg-white px-3 text-[14px] outline-none"
                placeholder="Enter Voucher Code"
              />
              <button type="button" className="rounded bg-[#ff7f2a] px-4 text-[14px] font-bold text-white">
                APPLY
              </button>
            </div>
          </div>
        </>
      ) : null}
    </aside>
  );
}

function sessionLabel(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `Your Session will expire in ${String(mins).padStart(2, '0')} mins : ${String(secs).padStart(2, '0')} secs`;
}

function SessionStrip({ step }) {
  const location = useLocation();
  const [remainingSeconds, setRemainingSeconds] = useState(FLOW_SESSION_SECONDS);

  const flowSignature = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return ['priceId', 'returnPriceId', 'amount'].map((key) => params.get(key) || '').join('|');
  }, [location.search]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const now = Date.now();
    let expiresAt = Number(window.sessionStorage.getItem(FLOW_SESSION_EXPIRES_KEY));
    const storedSignature = window.sessionStorage.getItem(FLOW_SESSION_SIGNATURE_KEY) || '';
    const validExpiry = Number.isFinite(expiresAt) && expiresAt > now;
    const shouldReset = !validExpiry || (step === 1 && flowSignature && flowSignature !== storedSignature);

    if (shouldReset) {
      expiresAt = now + FLOW_SESSION_SECONDS * 1000;
      window.sessionStorage.setItem(FLOW_SESSION_EXPIRES_KEY, String(expiresAt));
      if (flowSignature) window.sessionStorage.setItem(FLOW_SESSION_SIGNATURE_KEY, flowSignature);
    }

    const tick = () => {
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(left);
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [flowSignature, step]);

  return (
    <div className="mt-5 bg-black py-3 text-center text-[14px] font-bold text-white">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/70 text-[13px]">O</span>
      <span className="ml-3">{sessionLabel(remainingSeconds)}</span>
    </div>
  );
}

function FooterBlock() {
  return (
    <footer className="bg-[#3f4250] text-white">
      <div className="mx-auto max-w-[1320px] px-5 py-8">
        <div className="flex flex-col items-start justify-between gap-5 border-b border-white/10 pb-8 md:flex-row md:items-center">
          <div>
            <div className="text-[40px] leading-tight text-white">How can we help you?</div>
            <div className="text-[14px] text-white">Contact us anytime.</div>
          </div>
          <div className="flex gap-5 rounded bg-white/10 px-6 py-4 text-[14px]">
            <div>
              <div className="text-[11px] font-bold uppercase text-white/80">Send us an email at</div>
              <div className="font-semibold">support@tripjack.com</div>
            </div>
            <div className="w-px bg-white/30" />
            <div>
              <div className="text-[11px] font-bold uppercase text-white/80">Or call us at</div>
              <div className="font-semibold">022 62506250</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 py-8 text-[14px] text-white/95 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <div className="text-[40px] font-black leading-none">
              <span className="text-[#8a8f9f]">trip</span>
              <span className="text-[#f18a1f]">jack</span>
            </div>
            <div className="mt-4 text-[12px] text-white">(c) 2026 Tripjack. All Rights Reserved.</div>
          </div>
          <div>
            <div className="mb-3 font-bold uppercase text-white/85">More Links</div>
            <div className="space-y-2">
              <div>Terms & conditions</div>
              <div>Payment Security</div>
            </div>
          </div>
          <div>
            <div className="mb-3 font-bold uppercase text-white/85">Policies</div>
            <div>Privacy Policy</div>
          </div>
          <div>
            <div className="mb-3 font-bold uppercase text-white/85">Resources</div>
            <div>Careers</div>
          </div>
          <div>
            <div className="mb-3 font-bold uppercase text-white/85">Get in Touch</div>
            <div>Careers</div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function OverlayLoader() {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#2e2e2ec2]">
      <div className="flex items-center gap-10">
        <span className="h-12 w-12 rounded-full bg-[#ff7f2a]" />
        <span className="h-6 w-6 rounded-full bg-[#ff7f2a]" />
      </div>
    </div>
  );
}

export default function FlightFlowLayout({
  step,
  title,
  titleAction,
  fare,
  children,
  includeMealBaggage = false,
  showCash = true,
  alert,
  overlayLoading = false,
}) {
  const location = useLocation();
  const [completedStep, setCompletedStep] = useState(step);

  const flowSignature = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return ['priceId', 'returnPriceId', 'amount'].map((key) => params.get(key) || '').join('|');
  }, [location.search]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const rawStep = Number(window.sessionStorage.getItem(FLOW_COMPLETED_STEP_KEY));
    const storedStep = Number.isFinite(rawStep) ? Math.min(4, Math.max(1, rawStep)) : 1;
    const storedSignature = window.sessionStorage.getItem(FLOW_PROGRESS_SIGNATURE_KEY) || '';
    const isNewFlow = step === 1 && flowSignature && storedSignature && flowSignature !== storedSignature;

    const nextCompletedStep = Math.max(isNewFlow ? 1 : storedStep, step);

    window.sessionStorage.setItem(FLOW_COMPLETED_STEP_KEY, String(nextCompletedStep));
    if (flowSignature) window.sessionStorage.setItem(FLOW_PROGRESS_SIGNATURE_KEY, flowSignature);
    setCompletedStep(nextCompletedStep);
  }, [flowSignature, step]);

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1f2937]">
      {alert ? (
        <div
          className={clsx(
            'px-5 py-4 text-center text-[15px] font-bold',
            alert.type === 'error' ? 'bg-[#e8563f] text-white' : 'bg-[#e3d36b] text-[#1f1f1f]',
          )}
        >
          {alert.text}
        </div>
      ) : null}
      <Stepper step={step} completedStep={completedStep} />

      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-0 px-5 pb-0 pt-0 lg:grid-cols-[1fr_360px]">
        <div className="border-r border-[#d5d5d5] py-4 pr-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[34px] font-medium text-[#1f2c3d]">{title}</h1>
            {titleAction ? <div>{titleAction}</div> : null}
          </div>
          {children}
        </div>
        <div className="py-4 pl-4">
          <FareSummary fare={fare} includeMealBaggage={includeMealBaggage} showCash={showCash} />
        </div>
      </div>

      <SessionStrip step={step} />
      <FooterBlock />
      {overlayLoading ? <OverlayLoader /> : null}
    </div>
  );
}
