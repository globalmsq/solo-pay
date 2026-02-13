import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentModal({
  product,
  paymentId,
  onClose,
}: {
  product: { price: number };
  paymentId: string;
  onClose: () => void;
}) {
  const router = useRouter();

  const tokenAddress =
    process.env.NEXT_PUBLIC_SOLO_PAY_TOKEN_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

  const widgetUrl = useMemo(() => {
    const url = new URL(process.env.NEXT_PUBLIC_WIDGET_URL || 'http://localhost:3005');
    url.searchParams.set('pk', process.env.NEXT_PUBLIC_SOLO_PAY_PUBLIC_KEY || '');
    url.searchParams.set('orderId', `${paymentId}`);
    url.searchParams.set('amount', `${product.price}`);
    url.searchParams.set('tokenAddress', tokenAddress);
    url.searchParams.set(
      'successUrl',
      `${window.location.origin}/payments/success?paymentId=${paymentId}`
    );
    url.searchParams.set('failUrl', `${window.location.origin}`);
    return url.toString();
  }, [paymentId, product.price, tokenAddress]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Handle payment complete message from widget
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'payment_complete' && event.data.status === 'success') {
        onClose();
        router.push(`/payments/success?paymentId=${paymentId}`);
      }
      if (event.data.type === 'payment_complete' && event.data.status === 'fail') {
        onClose();
        router.push('/');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose, router, paymentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-white shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          &#x2715;
        </button>
        <iframe src={widgetUrl} className="w-full h-[700px] border-none" />
      </div>
    </div>
  );
}
