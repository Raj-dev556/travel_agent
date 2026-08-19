import { ChevronLeft, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../api';
import FlightFlowLayout from './FlightFlowLayout';
import { buildFlowQuery, computeFare, hydrateFromQuery } from './flightFlowData';

function TermsCard({ accepted, setAccepted, amountLabel, onPay, paying }) {
  return (
    <div>
      <div className="mb-5 border border-[#e3e0d9] bg-[#f7f4ef] px-4 py-3 text-[17px] text-[#2f3f51]">
        By placing this order, you agree to our Terms Of Use and Privacy Policy
      </div>
      <button
        type="button"
        onClick={onPay}
        disabled={paying || !accepted}
        className="rounded bg-[#f3a97a] px-4 py-3 text-[14px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {paying ? 'Processing...' : `Pay Now ${amountLabel}`}
      </button>
      <label className="mt-4 flex items-center gap-2 text-[14px] text-[#2d3d4f]">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="h-5 w-5 accent-[#ff7f2a]" />
        I accept <span className="font-semibold text-[#1b56a2] underline">terms & conditions</span>
      </label>
    </div>
  );
}

export default function FlightPayment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const draft = useMemo(() => hydrateFromQuery(params), [params]);
  const fare = useMemo(() => computeFare(draft.amount), [draft.amount]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [paying, setPaying] = useState(false);
  const [topAlert, setTopAlert] = useState(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const query = buildFlowQuery(draft);

  const canUseRazorpayOrder = /^[a-f\d]{24}$/i.test(draft.bookingId || '');

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const { data: orderData } = useQuery({
    queryKey: ['paymentOrder', draft.bookingId],
    queryFn: () => api.post('/payments/order', { bookingId: draft.bookingId }).then((r) => r.data),
    enabled: canUseRazorpayOrder && Boolean(draft.bookingId),
    retry: 0,
  });

  const payViaRazorpay = () =>
    new Promise((resolve, reject) => {
      if (!window.Razorpay || !orderData) {
        reject(new Error('Payment gateway not ready.'));
        return;
      }

      const options = {
        key: orderData?.keyId,
        amount: orderData?.amount,
        currency: orderData?.currency,
        order_id: orderData?.orderId,
        name: 'TripJack Corporate',
        description: `Flight Booking - ${draft.bookingId}`,
        handler: async (response) => {
          try {
            await api.post('/payments/verify', {
              orderId: orderData?.orderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            resolve(response);
          } catch (err) {
            reject(err);
          }
        },
        modal: {
          ondismiss: () => reject(new Error('Payment cancelled')),
        },
        theme: { color: '#ff7f2a' },
      };

      const rz = new window.Razorpay(options);
      rz.open();
    });

  const proceedPayment = async () => {
    setPaying(true);
    setTopAlert({
      type: 'warning',
      text: `Please note down reference id: ${draft.bookingId || `TJS${Date.now()}`}`,
    });

    try {
      if (canUseRazorpayOrder && orderData && razorpayLoaded) {
        await payViaRazorpay();
      }
      const resolvedBookingId = draft.bookingId || `STUB-${Date.now()}`;
      const confirmParams = new URLSearchParams(query);
      confirmParams.set('bookingId', resolvedBookingId);
      navigate(`/flights/confirm?${confirmParams.toString()}`);
    } catch (err) {
      setTopAlert({
        type: 'error',
        text: err?.response?.data?.message || 'There is something went wrong with backend service. It could be due to invalid/bad data.',
      });
      setPaying(false);
    }
  };

  return (
    <FlightFlowLayout
      step={4}
      title="Payments"
      fare={fare}
      includeMealBaggage
      showCash={false}
      alert={
        topAlert && {
          ...topAlert,
          text: (
            <div className="flex items-center justify-center gap-4">
              <span>{topAlert.text}</span>
              <button type="button" onClick={() => setTopAlert(null)} className="font-bold">
                <X className="h-4 w-4" />
              </button>
            </div>
          ),
        }
      }
    >
      <div className="grid min-h-[420px] grid-cols-[420px_1fr] gap-4">
        <div className="border border-[#ddd] bg-[#f2f2f2]">
          <button type="button" className="w-full border-l-4 border-[#ff7f2a] bg-white px-5 py-5 text-left text-[17px] font-semibold text-[#253446]">
            Deposit
          </button>
          <button type="button" className="w-full border-t border-[#ddd] bg-[#f2f2f2] px-5 py-5 text-left text-[17px] font-semibold text-[#253446]">
            Net-banking / Credit Card/ Debit Card
          </button>
        </div>

        <div>
          <TermsCard
            accepted={acceptedTerms}
            setAccepted={setAcceptedTerms}
            amountLabel={`INR ${fare.total.toFixed(2)}`}
            onPay={proceedPayment}
            paying={paying}
          />
        </div>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={() => navigate(`/flights/review?${query}`)}
          className="inline-flex items-center rounded bg-[#ff7f2a] px-7 py-3 text-[15px] font-bold text-white"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
      </div>
    </FlightFlowLayout>
  );
}
